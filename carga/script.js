import init, { parse_email } from "./pkg/eml_parser.js";
await init();

function parseLocaleNumber(stringNumber) {
    const locale = "pt-BR";
    const formatter = new Intl.NumberFormat(locale);
    const parts = formatter.formatToParts(1111.1);

    const group = parts.find(p => p.type === "group").value;
    const decimal = parts.find(p => p.type === "decimal").value;

    return parseFloat(
        stringNumber
            .replaceAll(group, '')
            .replace(decimal, '.')
    );
}

function listenForFile(onFileReady) {
    const dropZone = document.querySelector(".drop-zone");
    const dropZoneLabel = dropZone.querySelector("label");

    if (!dropZone || !dropZoneLabel) {
        console.log("drop-zone elements in DOM not found ");
        return;
    }

    const defaultDropMessage = dropZoneLabel.textContent;
    const dragMessage = "solte!"

    let dragCounter = 0;

    const processFiles = (files) => {
        if (!files || files.length === 0 || files.length > 1) return;

        const file = files[0];
        setTimeout(() => onFileReady(file), 0);
    };

    dropZone.addEventListener("change", (e) => {
        if (e.target?.files) {
            processFiles(e.target.files)
        }
        e.target.value = "";
    });


    window.addEventListener("dragenter", (e) => {
        e.preventDefault();
        dragCounter++;

        if (dragCounter !== 1) return;

        dropZone.classList.add("invert");
        dropZoneLabel.textContent = dragMessage;
    });

    window.addEventListener("dragover", (e) => {
        e.preventDefault();
    });

    window.addEventListener("dragleave", (e) => {
        e.preventDefault();
        dragCounter--;

        if (dragCounter > 0 && (e.clientX !== 0 || e.clientY !== 0)) return;

        dragCounter = 0;
        dropZone.classList.remove("invert");
        dropZoneLabel.textContent = defaultDropMessage;
    });

    window.addEventListener("drop", (e) => {
        e.preventDefault();
        dragCounter = 0;
        dropZone.classList.remove("invert");
        dropZoneLabel.textContent = defaultDropMessage;

        if (e.dataTransfer?.files) {
            processFiles(e.dataTransfer.files)
        }
    });
}

async function parseFile(file) {
    const container = document.getElementById("tables-container") || document.getElementById("container");
    container.innerHTML = "";

    const rawEml = await file.arrayBuffer();
    const uint8Array = new Uint8Array(rawEml);
    const emlEmailHTML = parse_email(uint8Array);

    if (!emlEmailHTML?.html) return;

    const domParser = new DOMParser();
    const emailDoc = domParser.parseFromString(emlEmailHTML.html, "text/html");

    const table = Array.from(emailDoc.querySelectorAll("table")).find(t =>
        t.textContent.includes("Pedido") && t.textContent.includes("Produto")
    ) || emailDoc.querySelectorAll("table")[0];
    if (!table) return console.log("No tables found");

    const lines = Array.from(table.querySelectorAll("tr")).map(row =>
        Array.from(row.querySelectorAll("td, th")).map(cell => cell.textContent.replace(/\s+/g, ' ').trim())
    ).filter(line => line.length > 0 && line.some(c => c !== ""));

    if (lines.length === 0) return;

    const headers = lines.shift();
    const total = lines.pop();

    const orders = lines.map(line => {
        return headers.reduce((obj, header, index) => {
            let value = line[index];

            if (header === "Quantidade") value = parseLocaleNumber(value);
            if (header === "Pedido") value = value.split("-")[1];
            if (header === "Cliente") value = value.split("-")[1];
            obj[header] = value;
            return obj;
        }, {});
    });

    const byProduct = orders.reduce((acc, cur) => {
        const product = cur["Produto"];
        if (!acc[product]) acc[product] = [];

        acc[product].push({
            order: cur["Pedido"],
            client: cur["Cliente"],
            dest: cur["Destino"],
            qtd: cur["Quantidade"],
        });

        return acc;
    }, {});

    // Ordenar os dados dentro do byProduct
    for (const product in byProduct) {
        byProduct[product].sort((a, b) => {
            const compareClient = a.client.localeCompare(b.client);
            if (compareClient !== 0) return compareClient;
            return b.qtd - a.qtd;
        });
    }

    const loadInfoTemplate = document.querySelector('#load-info-template');
    const sectionTemplate = document.querySelector('#product-section-template');
    const rowTemplate = document.querySelector('#order-row-template');

    // Implementar segurança
    const loadInfoClone = loadInfoTemplate.content.cloneNode(true);
    loadInfoClone.querySelector(".load-date").textContent = new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(new Date(emlEmailHTML.date));
    loadInfoClone.querySelector(".load-id").textContent = emailDoc.body.textContent.match(/Carga:\s*([^\s]+)/i)?.[1] || "";
    loadInfoClone.querySelector(".load-plate").textContent = emailDoc.body.textContent.match(/Veículo:\s*([^\s\nMotorista:]+)/)?.[1] || "";
    loadInfoClone.querySelector(".load-carrier").textContent = emailDoc.body.textContent.match(/Transportadora:\s*([^\nVeículo:]+)/)?.[1] || "";

    container.appendChild(loadInfoClone);

    Object.entries(byProduct).forEach(([productName, ordersList]) => {
        const sectionClone = sectionTemplate.content.cloneNode(true);

        sectionClone.querySelector(".product-title").textContent = `Produto: ${productName}`;

        const tbody = sectionClone.querySelector(".orders-body");
        let totalQtd = 0;

        ordersList.forEach(order => {
            const rowClone = rowTemplate.content.cloneNode(true);

            rowClone.querySelector(".order-id").textContent = order.order;
            rowClone.querySelector(".order-client").textContent = order.client;
            rowClone.querySelector(".order-dest").textContent = order.dest;
            rowClone.querySelector(".order-qtd").textContent = order.qtd;

            totalQtd += Number(order.qtd) || 0;

            tbody.appendChild(rowClone);
        });

        sectionClone.querySelector(".product-total").textContent = totalQtd;
        container.appendChild(sectionClone);
    });

}

listenForFile((file) => parseFile(file));
