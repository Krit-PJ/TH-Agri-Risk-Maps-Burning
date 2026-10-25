/**
 * คัดลอกไฟล์นี้เป็น "Secrets.gs" ในโครงการ Apps Script แล้วใส่ค่าจริง
 * ไฟล์ Secrets.gs ต้องไม่อยู่ใน GitHub (อยู่ใน .gitignore)
 * ใช้เฉพาะตอนติดตั้งครั้งแรก: ระบบสร้าง Admin เริ่มต้น และเก็บรหัส Super Admin เป็นค่า Hash ใน Script Properties
 * ใส่เบอร์โทรเป็นข้อความในเครื่องหมายคำพูดเสมอ เพื่อคงเลข 0 นำหน้า
 */
var INIT_ADMIN_PHONE = '0xxxxxxxxx';   // เบอร์โทร Admin เริ่มต้น
var INIT_ADMIN_PROVINCE = '62';         // รหัสจังหวัดของ Admin เริ่มต้น (62 = กำแพงเพชร)
var INIT_SUPER_USER = 'ชื่อผู้ใช้';
var INIT_SUPER_PASSWORD = 'รหัสผ่าน';
