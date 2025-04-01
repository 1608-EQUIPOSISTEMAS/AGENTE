const formatoFecha = (valor) => {
    if (!valor) return "Fecha no disponible";
    let date = new Date(valor);
    if (isNaN(date.getTime())) return "Fecha inválida";
    return `${date.getDate().toString().padStart(2, '0')}/` + 
           `${(date.getMonth() + 1).toString().padStart(2, '0')}/` + 
           `${date.getFullYear()}`;
};

module.exports = { formatoFecha };
