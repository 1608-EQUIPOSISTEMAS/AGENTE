const xlsx = require('xlsx');

// Cargar el archivo cursos.xlsx
const workbook = xlsx.readFile('SEGUIMIENTO.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet);

// Mostrar los datos en consola
console.log(data);
