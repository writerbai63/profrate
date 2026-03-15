const searchBtn = document.getElementById("searchBtn");
const searchInput = document.getElementById("searchInput");
const teachersDiv = document.getElementById("teachers");

searchBtn.addEventListener("click", search);

function search(){

const query = searchInput.value.toLowerCase();

fetch("http://localhost:3000/teachers")
.then(res => res.json())
.then(data => {

teachersDiv.innerHTML = "";

const filtered = data.filter(t =>
t.name.toLowerCase().includes(query)
);

if(filtered.length === 0){
teachersDiv.innerHTML = "Nəticə tapılmadı";
return;
}

filtered.forEach(t => {

const card = document.createElement("div");

card.style.margin = "20px";
card.style.padding = "15px";
card.style.background = "white";
card.style.borderRadius = "8px";
card.style.boxShadow = "0 0 5px rgba(0,0,0,0.2)";

card.innerHTML = `
<h3>${t.name}</h3>
<p><b>Fakültə:</b> ${t.faculty}</p>
<p><b>Kafedra:</b> ${t.department}</p>
<p><b>Fənn:</b> ${t.subjects}</p>
`;

teachersDiv.appendChild(card);

});

});

}
searchInput.addEventListener("keypress", function(e){
if(e.key === "Enter"){
search();
}
});
const filtered = data.filter(t =>
t.name.toLowerCase().includes(query) ||
t.subjects.toLowerCase().includes(query)
);
card.className = "card";