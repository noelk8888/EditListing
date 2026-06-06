const text = `G10473
*BUSINESS FOR SALE*
Business: Baking goods supply`;
const regex = /^.*?\b(FOR\s+(SALE|LEASE|SALE\s*(AND|\/|&)\s*LEASE|SALE\/LEASE)|AVAILABLE|SOLD|LEASED OUT|OFF THE MARKET|ON HOLD|UNDER NEGO|UNDECISIVE SELLER)\b.*$/im;
console.log('Match?', regex.test(text));
if (regex.test(text)) console.log('Replaced:\n' + text.replace(regex, '*OFF THE MARKET*'));
