# Thailand Agri-Risk Maps Burning V2 — คู่มือดูแลระบบ

## โครงสร้างระบบ

- GitHub Pages เผยแพร่แผนที่และข้อมูลขอบเขตจังหวัด อำเภอ และตำบล 77 จังหวัด
- หน้าแรกแสดงเฉพาะจังหวัดที่มีข้อมูล HS ที่ผ่านการตรวจและอยู่ในชุดเผยแพร่
- Google Apps Script Web App ใช้สำหรับลงทะเบียน รับทราบ PDPA เข้าสู่ระบบ และจัดการข้อมูลตามสิทธิ์
- Google Sheet ส่วนตัวเก็บบัญชี คำขอลงทะเบียน ข้อมูล HS ประวัติการใช้งาน และค่าระบบ

## สิทธิ์

- ผู้ใช้ทั่วไปอ่านข้อมูลสาธารณะได้โดยไม่ต้องเข้าสู่ระบบ
- Admin จัดการข้อมูลได้เฉพาะ `provinceCode` ที่ผูกกับบัญชี
- Super Admin อนุมัติคำขอและจัดการได้ทุกจังหวัด
- หมายเลขโทรศัพท์เป็นรหัสระบุตัวตน ไม่ได้ถูกเผยแพร่ใน GitHub และถูกเก็บเป็น SHA-256 แบบมี pepper ในชีต
- การเปิดใช้งานครั้งแรกของ Admin ต้องใช้รหัสครั้งเดียวเพื่อผูกอุปกรณ์ หลังจากนั้นหน้าเข้าสู่ระบบขอเพียงหมายเลขโทรศัพท์

## การเปิดจังหวัดใหม่ในหน้าแรก

1. ตรวจสอบขอบเขตใน `app/data/boundary/<provinceCode>/`
2. ตรวจสอบไฟล์ HS และพิกัดให้ผ่านชุดทดสอบ
3. วางไฟล์เผยแพร่ใน `app/data/hotspot/<provinceCode>/`
4. รัน `node tools/build-public-data.cjs` ด้วยแหล่งข้อมูลที่ผ่านการตรวจ
5. ตรวจว่า `app/data/catalog.json` เพิ่มรหัสจังหวัดใน `activeProvinceCodes`
6. รันชุดทดสอบก่อน push ไป `main`

## การกู้คืนและตรวจสอบ

- ทุกการบันทึก อนุมัติ ลบ และเผยแพร่ต้องมีรายการใน `AuditLog`
- หากอุปกรณ์ Admin เปลี่ยน ให้ Super Admin ออกรหัสเปิดใช้งานใหม่ก่อนผูกอุปกรณ์ใหม่
- ห้ามนำ `AUTH_PEPPER`, ค่าแฮชรหัสผ่าน, token หรือข้อมูลส่วนบุคคลลง GitHub
- หาก Apps Script deployment เปลี่ยน URL ให้อัปเดต `app/config/public-runtime.json` แล้วทดสอบลิงก์จากหน้าแรก

## ลิงก์ระบบ

- เว็บไซต์: https://krit-pj.github.io/TH-Agri-Risk-Maps-Burning/
- ฐานข้อมูลส่วนตัว: https://docs.google.com/spreadsheets/d/1cZcb2zl-wJyNSkBtYazY_6jk5j3l3OMGPXZYQZKBCUw/edit
- Apps Script: https://script.google.com/d/1JKeXy3EWniAFiIl2-dRFDjD2IX97r7yyDiqo_HcmZdjrLO6wsNrSHm2J/edit
