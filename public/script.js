if (localStorage.getItem("loggedIn") !== "true") {
    window.location.href = "login.html";
}

async function loadData() {
    const response = await fetch("/api/all");
    const data = await response.json();

    const dataList = document.getElementById("dataList");
    dataList.innerHTML = "";

    data.forEach(item => {
        let html = "";

        Object.keys(item).forEach(key => {
            if (key !== "id") {
                html += `<p><strong>${key}:</strong> ${item[key]}</p>`;
            }
        });

        dataList.innerHTML += `
            <div class="item">
                <div class="item-content">${html}</div>
                <div class="buttons">
                    <button class="edit-btn" onclick='editRecord(${JSON.stringify(item)})'>Edit</button>
                    <button class="delete-btn" onclick="deleteData(${item.id})">Delete</button>
                </div>
            </div>
        `;
    });
}

document.getElementById("welcomeText").textContent =
    "Welcome, " + localStorage.getItem("username") + " 👋";

document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("loggedIn");
    localStorage.removeItem("username");

    window.location.href = "login.html";
});

async function addData() {
    const name = document.getElementById("nameInput").value.trim();
    const email = document.getElementById("emailInput").value.trim();

    if (!name || !email) {
        alert("Name and Email are required");
        return;
    }

    const record = {
        id: Date.now(),
        name,
        email,
        createdAt: new Date().toLocaleString(),
        updatedAt: new Date().toLocaleString()
    };

    document.querySelectorAll(".extra-field").forEach(fieldDiv => {
        const input = fieldDiv.querySelector("input");

        if (input.type === "checkbox") {
            record[input.id] = input.checked;
        } else {
            record[input.id] = input.value.trim();
        }
    });

    await fetch("/api/create", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(record)
    });
    document.getElementById("nameInput").value = "";
    document.getElementById("emailInput").value = "";
    extraFields.innerHTML = "";

    loadData();
}


async function deleteData(id) {
    const confirmDelete = confirm(
        "Are you sure nigga you want to delete this record?"
    );

    if (!confirmDelete) {
        return;
    }

    await fetch(`/api/delete/${id}`, {
        method: "DELETE"
    });

    loadData();
}

// EDIT RECORDS
const editModal = document.getElementById("editModal");
const editFields = document.getElementById("editFields");

let currentEditingRecord = null;

function editRecord(record) {

    currentEditingRecord = { ...record };

    editFields.innerHTML = "";

    Object.keys(record).forEach(key => {

        if (key === "id") return;

        const input = document.createElement("input");

        input.type = "text";
        input.value = record[key];

        input.id = `edit-${key}`;

        input.placeholder = key;

        editFields.appendChild(input);
    });

    editModal.classList.remove("hidden");
}

document.getElementById("saveEditBtn")
.addEventListener("click", async () => {

    Object.keys(currentEditingRecord).forEach(key => {

        if (key === "id") return;

        const input = document.getElementById(`edit-${key}`);

        if (!input) return;

        const value = input.value.trim();

        // 🔥 Remove field if empty
        if (value === "") {

            // keep important fields
            if (
                key !== "name" &&
                key !== "email" &&
                key !== "createdAt"
            ) {
                delete currentEditingRecord[key];
            }

        } else {

            currentEditingRecord[key] = value;
        }
    });

    currentEditingRecord.updatedAt =
        new Date().toLocaleString();

    await fetch(`/api/edit/${currentEditingRecord.id}`, {
        method: "PUT",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify(currentEditingRecord)
    });

    editModal.classList.add("hidden");

    loadData();
});

document.getElementById("closeModal")
.addEventListener("click", () => {
    editModal.classList.add("hidden");
});

document.getElementById("addEditFieldBtn")
.addEventListener("click", () => {

    const field = document.getElementById("newFieldSelect").value;

    if (!field) return;

    if (document.getElementById(`edit-${field}`)) {
        alert("Field already exists");
        return;
    }

    currentEditingRecord[field] = "";

    const input = document.createElement("input");

    input.type = "text";
    input.placeholder = field;

    input.id = `edit-${field}`;

    editFields.appendChild(input);
});

const themeToggle = document.getElementById("themeToggle");

// Load saved theme
if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
}

themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");

    if (document.body.classList.contains("dark")) {
        localStorage.setItem("theme", "dark");
    } else {
        localStorage.setItem("theme", "light");
    }
});

const addFieldBtn = document.getElementById("addFieldBtn");
const fieldSelect = document.getElementById("fieldSelect");
const extraFields = document.getElementById("extraFields");

addFieldBtn.addEventListener("click", () => {
    const field = fieldSelect.value;

    if (!field) {
        alert("Please choose a field");
        return;
    }

    if (document.getElementById(`field-${field}`)) {
        alert("Field already added");
        return;
    }

    const fieldDiv = document.createElement("div");
    fieldDiv.className = "extra-field";
    fieldDiv.id = `field-${field}`;

    if (field === "isActive") {
        fieldDiv.innerHTML = `
            <label>
                <input type="checkbox" id="${field}">
                ${field}
            </label>
            <button type="button" onclick="removeField('${field}')">✖</button>
        `;
        } else {
        fieldDiv.innerHTML = `
            <input type="text" id="${field}" placeholder="Enter ${field}">
            <button type="button" onclick="removeField('${field}')">✖</button>
        `;
    }

    extraFields.appendChild(fieldDiv);
});

function removeField(field) {
    const element = document.getElementById(`field-${field}`);
    if (element) {
        element.remove();
    }
}

loadData();