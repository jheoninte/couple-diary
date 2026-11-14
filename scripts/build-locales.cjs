const fs=require('node:fs'),path=require('node:path');
const codes=['ko','en','ja','zh-Hans','zh-Hant','es','pt-BR','fr','id','vi','de','th','ms','it','ru','tr','ar','hi'];const catalogs=Object.fromEntries(codes.map(code=>[code,{}]));
for(const name of fs.readdirSync('locales').filter(name=>name.endsWith('.tsv')).sort())for(const [index,line]of fs.readFileSync(path.join('locales',name),'utf8').split(/\r?\n/).entries()){
 if(!line.trim())continue;const cells=line.split('|');if(cells.length!==codes.length||cells.some(cell=>!cell.trim()))throw Error(`${name}:${index+1}: Expected ${codes.length} non-empty columns`);
 if(Object.hasOwn(catalogs.ko,cells[0]))throw Error(`${name}:${index+1}: Duplicate source key: ${cells[0]}`);
 codes.forEach((code,i)=>{catalogs[code][cells[0]]=cells[i];});
}
fs.writeFileSync('locales/catalogs.json',JSON.stringify(catalogs));console.log(`${Object.keys(catalogs.en).length} keys × ${codes.length} locales generated`);
