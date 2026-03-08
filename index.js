const PALLET_SIZE = 64;
const EXPIRATION_MONTHS = 9;

const PRODUCTS = [
    { code: "(B)LB", label: "ELO" },
    { code: "(B)LBD", label: "CHEF" },
    { code: "(B)LBF", label: "FLOR" },
];

const batchTemplate = document.getElementById("batch-template");
const batchList = document.getElementById("batch");
const saleSummary = document.getElementById("sale-summary");
const bonusSummary = document.getElementById("bonus-summary");
const total = document.getElementById("total");
const addButton = document.getElementById("add-button");
const loadIdInput = document.getElementById("load-id");
const copySale = document.getElementById("copy-sale");
const copyBonus = document.getElementById("copy-bonus");

function formatDate(year, month, day) {
    return [
        String(day).padStart(2, "0"),
        String(month).padStart(2, "0"),
        year,
    ].join("/");
}

function addCalendarMonths(dateString, months) {
    if (!dateString) return "";

    const [year, month, day] = dateString.split("-").map(Number);
    const targetMonthIndex = (month - 1) + months;
    const targetYear = year + Math.floor(targetMonthIndex / 12);
    const targetMonth = ((targetMonthIndex % 12) + 12) % 12;

    const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const targetDay = Math.min(day, lastDayOfTargetMonth);

    return formatDate(targetYear, targetMonth + 1, targetDay);
}

function getRowData(row) {
    const batchCode = row.querySelector(".batch-code").value.trim();
    const manufacturingDate = row.querySelector(".expiration-date").value;
    const pallets = Number(row.querySelector(".quantity").value) || 0;
    const bonus = Number(row.querySelector(".bonus").value) || 0;
    const saleQuantity = pallets * PALLET_SIZE - bonus;

    const manufacturingDateFormated = addCalendarMonths(manufacturingDate, 0);
    const expirationDateFormated = addCalendarMonths(manufacturingDate, EXPIRATION_MONTHS);

    const isValid = !row.querySelector(".batch-code").classList.contains('invalid');

    return {
        batchCode,
        manufacturingDateFormated,
        expirationDateFormated,
        pallets,
        bonus,
        saleQuantity,
        isValid
    };
}

function formatBatchLine({ batchCode, manufacturingDateFormated, expirationDateFormated }) {
    return [
        `Lote: ${batchCode}`,
        `Data de Fabricação: ${manufacturingDateFormated}`,
        `Data de Validade: ${expirationDateFormated}`,
    ].join(" ");
}

function addBatch() {
    const fragment = batchTemplate.content.cloneNode(true);
    const row = fragment.querySelector(".batch-row");

    // Init individual itens
    const quantity = row.querySelector(".quantity");
    const bonus = row.querySelector(".bonus");
    const productName = row.querySelector(".product-name");
    const batchCode = row.querySelector(".batch-code");
    const expirationDate = row.querySelector(".expiration-date");

    // Make any updatable class updateSummary as fallback
    row.querySelectorAll(".updatable").forEach((field) => {
        field.addEventListener("input", updateSummary);
        // field.addEventListener("change", updateSummary);
    });

    // Handle delete button
    row.querySelector(".delete-button").addEventListener("click", () => {
        if (batchList.childElementCount === 1) return;
        row.remove();
        updateSummary();
    });

    // Register products
    PRODUCTS.forEach(function (p) {
        var opt = document.createElement("option");
        opt.value = p.code;
        opt.textContent = p.label + " [" + p.code + "]";
        productName.appendChild(opt);
    });
    batchCode.placeholder = `${productName.value}000/00`;
    productName.addEventListener("change", () => {
        batchCode.placeholder = `${productName.value}000/00`;
        var val = expirationDate.value;
        if (!val) return;
        var parts = val.split("-");
        var y = Number(parts[0]),
            m = Number(parts[1]),
            d = Number(parts[2]);
        var dayOfYear = Math.floor(
            (new Date(y, m - 1, d) - new Date(y, 0, 0)) / 86400000,
        );
        batchCode.value =
            productName.value +
            String(dayOfYear).padStart(3, "0") +
            "/" +
            String(y).slice(-2);

        batchCode.classList.remove("invalid");
        updateSummary();
    });

    batchCode.addEventListener("input", () => {
        batchCode.classList.add("invalid");
        var batch = batchCode.value.trim().toUpperCase();
        batchCode.value = batch;
        if (batch == "") {
            return;
        }

        var prefix = null;
        var sorted = PRODUCTS.slice().sort(function (a, b) {
            return b.code.length - a.code.length;
        });

        for (var i = 0; i < sorted.length; i++) {
            if (batch.indexOf(sorted[i].code) === 0) {
                prefix = sorted[i].code;
                break;
            }
        }
        if (!prefix) {
            return;
        }

        var code = batch.slice(prefix.length);
        var restMatch = code.match(/^(\d{3})\/(\d{2})$/);
        if (!restMatch) return;

        var dayOfYear = Number(restMatch[1]);
        var year = 2000 + Number(restMatch[2]);
        var isLeap =
            (year % 4 === 0 && year % 100 !== 0) ||
            year % 400 === 0;
        var maxDay = isLeap ? 366 : 365;

        if (dayOfYear > maxDay) return;

        var date = new Date(year, 0, dayOfYear);
        expirationDate.valueAsDate = date;

        console.log(date);


        batchCode.classList.remove("invalid");
        productName.value = prefix;
        updateSummary();
    });

    expirationDate.addEventListener("change", () => {
        var val = expirationDate.value;
        if (!val) return;
        var parts = val.split("-");
        var y = Number(parts[0]),
            m = Number(parts[1]),
            d = Number(parts[2]);
        var dayOfYear = Math.floor(
            (new Date(y, m - 1, d) - new Date(y, 0, 0)) / 86400000,
        );
        batchCode.value =
            productName.value +
            String(dayOfYear).padStart(3, "0") +
            "/" +
            String(y).slice(-2);

        batchCode.classList.remove("invalid");
        updateSummary();
    })

    quantity.addEventListener("input", () => {
        const quantityValue = Number(quantity.value);
        if (quantityValue < 0) {
            quantity.value = 0;
        }
        bonus.value = 0;
        updateSummary()
    });

    bonus.addEventListener("input", () => {
        const bonusValue = Number(bonus.value);
        const maxBonusValue = Number(quantity.value) * PALLET_SIZE - 1;
        if (bonusValue < 0 || bonusValue > maxBonusValue) {
            bonus.value = 0;
        }
        updateSummary()
    });

    batchList.appendChild(fragment);
    updateSummary();
}

function updateSummary() {
    const loadText = `Nº da Carga: ${loadIdInput.value.trim()}`;
    const saleLines = [loadText];
    const bonusLines = [];

    let totalPallets = 0;
    let totalSale = 0;
    let totalBonus = 0;

    for (const row of batchList.children) {
        const data = getRowData(row);
        // if (!data.isValid) return;

        const baseLine = formatBatchLine(data);

        saleLines.push(
            `${baseLine} Quant: ${data.saleQuantity} Pallets: ${data.pallets};`
        );

        if (data.bonus !== 0) {
            bonusLines.push(`${baseLine} Quant: ${data.bonus};`);
        }

        totalPallets += data.pallets;
        totalSale += data.saleQuantity;
        totalBonus += data.bonus;
    }

    saleSummary.textContent = saleLines.join("\n");
    bonusSummary.textContent = bonusLines.length
        ? [loadText, ...bonusLines].join("\n")
        : "";

    total.innerHTML = `<b>PALETES:</b> ${totalPallets} | <b>VENDA:</b> ${totalSale} | <b>BONIFICAÇÃO:</b> ${totalBonus} | <b>TOTAL:</b> ${totalSale + totalBonus}`;
}

function copySummary(button, summary) {
    var clipText = summary.value.replaceAll('\n', ' ');

    navigator.clipboard
        .writeText(clipText)
        .then(function () {
            button.textContent = "Copiado!";
            setTimeout(function () {
                button.textContent = "Copiar";
            }, 2000);
        });
}

addButton.addEventListener("click", addBatch);
copySale.addEventListener("click", () => {
    copySummary(copySale, saleSummary);
});
copyBonus.addEventListener("click", () => {
    copySummary(copyBonus, bonusSummary);
});
loadIdInput.addEventListener("input", updateSummary);

addBatch();
