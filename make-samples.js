const XLSX = require('xlsx');
let seed = 2026; const r = m => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % m; };
const th1 = ['สมชาย','สมหญิง','วิชัย','นภา','ประเสริฐ','กัญญา','ธนากร','ศิริพร','อนุชา','พิมพ์ชนก','ณัฐวุฒิ','สุภาพร','ชัยวัฒน์','รัตนา','ปรีชา','มาลี','สุรชัย','จิราพร','เกรียงไกร','วรรณา','ธีระ','อรทัย','พงศ์พัฒน์','ขวัญใจ','กฤษดา','ปิยะนุช','วีระพงษ์','นันทนา','เอกชัย','พัชรี'];
const th2 = ['ใจดี','รักษาสัตย์','ศรีสุข','มั่นคง','พงษ์เจริญ','แสงทอง','วัฒนากุล','บุญมี','สุขสวัสดิ์','เจริญผล','ทองดี','สมบูรณ์','ประเสริฐศักดิ์','เพชรรัตน์','ชัยมงคล'];
const en1 = ['John','Emily','Michael','Sarah','David','Jessica','James','Anna','Robert','Olivia','Daniel','Sophia','Kenji','Yuki','Wei','Mei','Raj','Priya','Hans','Marie'];
const en2 = ['Smith','Johnson','Williams','Brown','Taylor','Anderson','Tanaka','Chen','Patel','Müller','Garcia','Lee','Kim','Nguyen','Wilson'];
const depts = ['Sales','Marketing','Finance','Human Resources','IT','Operations','Logistics','Customer Service','R&D','บัญชี (Accounting)','ฝ่ายผลิต (Production)'];
const rows = [['Employee ID','Full Name','Department']];
for (let i = 1; i <= 300; i++) {
  const thai = r(10) < 6;
  rows.push(['EMP' + String(i).padStart(4,'0'), thai ? th1[r(th1.length)] + ' ' + th2[r(th2.length)] : en1[r(en1.length)] + ' ' + en2[r(en2.length)], depts[r(depts.length)]]);
}
let ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = [{wch:14},{wch:30},{wch:26}];
let wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Participants'); XLSX.writeFile(wb, 'sample-participants.xlsx');
const prizes = [['Prize Name','Quantity','Rate (%)'],['Toyota Yaris (รถยนต์ใหม่)',1,0.01],['iPhone 17 Pro',3,0.5],['Gold Bar 1 Baht (ทองคำแท่ง)',5,1.5],['Cash 5,000 THB (เงินสด)',10,3],['Smart TV 55" (สมาร์ททีวี)',10,5],['Gift Voucher 1,000 THB',40,10],['Lucky Mug (แก้วน้ำ)',100,30],['Thank-You Gift (ของที่ระลึก)',200,49.99]];
ws = XLSX.utils.aoa_to_sheet(prizes); ws['!cols'] = [{wch:38},{wch:10},{wch:10}];
wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Prizes'); XLSX.writeFile(wb, 'sample-prizes.xlsx');
// verify round-trip
const back = XLSX.utils.sheet_to_json(XLSX.readFile('sample-participants.xlsx').Sheets.Participants, {header:1});
console.log(back.length - 1, 'participants;', back[1], back[2], back[300]);
