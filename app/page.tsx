"use client";

import { useState, useEffect } from "react";
import { auth, db } from "./lib/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail, // เพิ่มระบบกู้รหัสผ่าน
} from "firebase/auth";
import {
  addDoc,
  collection,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
} from "firebase/firestore";
import Swal from "sweetalert2"; // นำเข้าหน้าต่างแจ้งเตือนแบบมีแอนิเมชัน

// ตั้งค่าธีมให้ SweetAlert เข้ากับเว็บของเรา
const Toast = Swal.mixin({
  background: "#1e1b4b", // สีพื้นหลังม่วงเข้ม
  color: "#ffffff",
  customClass: {
    confirmButton: "bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg outline-none",
    cancelButton: "bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg outline-none ml-2",
  },
  buttonsStyling: false,
});

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<any>(null);

  const [itemName, setItemName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");

  const [items, setItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) loadItems();
  }, [user]);

  // ระบบสมัครสมาชิก
  const handleRegister = async () => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      setUser(result.user);
      Toast.fire({ icon: "success", title: "สมัครสมาชิกแล้ว", timer: 1500, showConfirmButton: false });
    } catch (error: any) {
      Toast.fire({ icon: "error", title: "เกิดข้อผิดพลาด", text: error.message });
    }
  };

  // ระบบเข้าสู่ระบบ
  const handleLogin = async () => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      setUser(result.user);
      Toast.fire({ icon: "success", title: "เข้าสู่ระบบแล้ว", timer: 1500, showConfirmButton: false });
    } catch (error: any) {
      Toast.fire({ icon: "error", title: "รหัสผ่านหรืออีเมลไม่ถูกต้อง", text: "กรุณาลองใหม่อีกครั้ง" });
    }
  };

  // ระบบลืมรหัสผ่าน
  const handleForgotPassword = async () => {
    if (!email) {
      Toast.fire({ icon: "warning", title: "กรุณากรอกอีเมล", text: "พิมพ์อีเมลของคุณในช่องด้านบนก่อนกดลืมรหัสผ่านครับ" });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      Toast.fire({ icon: "success", title: "ส่งลิงก์สำเร็จ!", text: "กรุณาเช็คกล่องจดหมายในอีเมลของคุณเพื่อตั้งรหัสผ่านใหม่" });
    } catch (error: any) {
      Toast.fire({ icon: "error", title: "เกิดข้อผิดพลาด", text: error.message });
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const handlePost = async () => {
    if (!itemName.trim() || !description.trim() || !location.trim() || !contact.trim()) {
      Toast.fire({ icon: "warning", title: "ข้อมูลไม่ครบ", text: "กรุณากรอกข้อมูลให้ครบถ้วน" });
      return;
    }
    if (!imageBase64 && !isEditing) {
      Toast.fire({ icon: "warning", title: "ลืมรูปภาพ", text: "กรุณาอัปโหลดรูปภาพสิ่งของด้วยครับ" });
      return;
    }

    setLoading(true);
    try {
      let imageUrl = imageBase64;
      if (imageFile) {
        if (imageFile.size > 700 * 1024) {
          Toast.fire({ icon: "warning", title: "ไฟล์ใหญ่เกินไป", text: "รูปภาพต้องมีขนาดไม่เกิน 700 KB" });
          setLoading(false);
          return;
        }
        const reader = new FileReader();
        imageUrl = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(imageFile);
        });
      }

      const postData = { itemName, description, location, contact, ...(imageUrl && { imageUrl }) };

      if (isEditing && editingId) {
        await updateDoc(doc(db, "items", editingId), postData);
        Toast.fire({ icon: "success", title: "แก้ไขประกาศแล้ว", timer: 1500, showConfirmButton: false });
        setIsEditing(false);
        setEditingId(null);
      } else {
        await addDoc(collection(db, "items"), {
          ...postData,
          userEmail: user.email,
          found: false,
          createdAt: new Date(),
        });
        Toast.fire({ icon: "success", title: "โพสต์ประกาศสำเร็จ!", timer: 1500, showConfirmButton: false });
      }

      setItemName(""); setDescription(""); setLocation(""); setContact(""); setImageFile(null); setImageBase64("");
      await loadItems();
    } catch (error: any) {
      Toast.fire({ icon: "error", title: "เกิดข้อผิดพลาด", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async () => {
    try {
      const q = query(collection(db, "items"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      setItems(querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (error: any) {
      console.error(error);
    }
  };

  // แอนิเมชันยืนยันการลบ
  const handleDelete = async (id: string) => {
    const result = await Toast.fire({
      title: "ต้องการลบโพสต์นี้?",
      text: "ลบแล้วจะกู้คืนไม่ได้นะครับ",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ใช่",
      cancelButtonText: "ไม่",
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, "items", id));
        Toast.fire({ icon: "success", title: "ลบโพสต์แล้ว", timer: 1500, showConfirmButton: false });
        await loadItems();
      } catch (error: any) {
        Toast.fire({ icon: "error", title: "เกิดข้อผิดพลาด", text: error.message });
      }
    }
  };

  const handleEdit = (item: any) => {
    setItemName(item.itemName); setDescription(item.description); setLocation(item.location); setContact(item.contact);
    setIsEditing(true); setEditingId(item.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleMarkAsFound = async (id: string) => {
    const result = await Toast.fire({
      title: "ยืนยันการเจอของ?",
      text: "คุณแน่ใจว่าพบของชิ้นนี้แล้วใช่ไหม?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "เจอแล้ว!",
      cancelButtonText: "ยกเลิก",
    });

    if (result.isConfirmed) {
      try {
        await updateDoc(doc(db, "items", id), { found: true });
        Toast.fire({ icon: "success", title: "ยินดีด้วยครับ!", text: "อัปเดตสถานะเป็นเจอของแล้ว", timer: 1500, showConfirmButton: false });
        await loadItems();
      } catch (error: any) {
        Toast.fire({ icon: "error", title: "เกิดข้อผิดพลาด", text: error.message });
      }
    }
  };

  const filteredItems = items.filter(
    (item) =>
      item.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const glassInputClass =
    "w-full mb-4 bg-black/20 hover:bg-black/40 border border-white/10 hover:border-white/30 rounded-xl px-5 py-4 text-white placeholder-white/30 focus:outline-none focus:bg-black/60 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/30 transition-all duration-300";

  // ==========================================
  // หน้า Login / Register (ปรับปรุงให้ไม่โล่ง)
  // ==========================================
  if (!user) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] flex justify-center items-center p-4 font-sans relative overflow-hidden">
        {/* แสงออร่าพื้นหลัง */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse delay-700"></div>

        <div className="w-full max-w-md bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] p-10 relative z-10 animate-fade-in-up">
          
          <div className="text-center mb-10 animate-fade-in-up delay-100">
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-300 tracking-tight mb-2 hover:scale-105 transition-transform duration-500">
              Lost & Found
            </h1>
            <p className="text-white/40 text-xs tracking-[0.2em] uppercase font-semibold mb-4">
              School Community
            </p>
            {/* เพิ่มข้อความต้อนรับให้หน้าเว็บดูมีรายละเอียด */}
            <p className="text-white/60 text-sm">
              ระบบแจ้งของหาย และตามหาเจ้าของ<br/>เพื่อสังคมในโรงเรียนของเรา
            </p>
          </div>

          <div className="space-y-4 animate-fade-in-up delay-200">
            <input
              type="email"
              placeholder="อีเมล (เช่น user@school.ac.th)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={glassInputClass}
            />
            <input
              type="password"
              placeholder="รหัสผ่าน"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={glassInputClass}
            />
            
            {/* ปุ่มลืมรหัสผ่าน */}
            <div className="flex justify-end mt-[-10px]">
              <button 
                onClick={handleForgotPassword}
                className="text-purple-400 text-sm hover:text-purple-300 hover:underline transition-all"
              >
                ลืมรหัสผ่านใช่ไหม?
              </button>
            </div>
          </div>

          <div className="mt-8 space-y-4 animate-fade-in-up delay-300">
            <button
              onClick={handleLogin}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-4 px-6 rounded-xl shadow-[0_0_15px_rgba(147,51,234,0.3)] hover:shadow-[0_0_30px_rgba(147,51,234,0.6)] hover:-translate-y-1 hover:scale-[1.02] active:scale-95 transition-all duration-300"
            >
              เข้าสู่ระบบ
            </button>
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 mx-4 text-white/30 text-xs">หรือ</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>
            <button
              onClick={handleRegister}
              className="w-full bg-transparent border border-white/20 text-white/70 font-semibold py-4 px-6 rounded-xl hover:bg-white/10 hover:text-white hover:-translate-y-1 hover:scale-[1.02] active:scale-95 transition-all duration-300"
            >
              สมัครสมาชิกใหม่
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================
  // หน้า Dashboard
  // ==========================================
  return (
    <main className="min-h-screen bg-[#0a0a0a] p-4 md:p-8 font-sans text-white relative overflow-hidden">
      {/* แสงออร่าพื้นหลัง */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] bg-purple-900/20 rounded-full blur-[150px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] bg-indigo-900/20 rounded-full blur-[150px]"></div>
      </div>

      <div className="max-w-4xl mx-auto bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-6 md:p-10 relative z-10 animate-fade-in-up">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 animate-fade-in-up delay-100">
          <div className="group cursor-default">
            <h1 className="text-3xl font-bold mb-1 tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70 group-hover:to-purple-400 transition-colors duration-500">
              Lost & Found
            </h1>
            <p className="text-white/50 text-sm flex items-center">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
              {user.email}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="mt-4 md:mt-0 bg-red-500/10 hover:bg-red-500/30 text-red-400 hover:text-white text-sm font-medium py-2.5 px-6 rounded-xl border border-red-500/20 hover:border-red-500/50 hover:-translate-y-1 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] active:scale-95 transition-all duration-300"
          >
            ออกจากระบบ
          </button>
        </div>

        {/* Form Section */}
        <div className="bg-black/30 rounded-2xl p-6 md:p-8 border border-white/5 mb-12 shadow-inner animate-fade-in-up delay-200">
          <h2 className="text-xl font-semibold mb-6 flex items-center text-white/90">
            <span className="bg-gradient-to-b from-purple-400 to-indigo-500 w-1.5 h-6 rounded-full mr-3 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></span>
            {isEditing ? "แก้ไขประกาศ" : "สร้างประกาศของหาย"}
          </h2>

          <input type="text" placeholder="ชื่อสิ่งของ" value={itemName} onChange={(e) => setItemName(e.target.value)} className={glassInputClass} />
          <textarea placeholder="รายละเอียด" value={description} onChange={(e) => setDescription(e.target.value)} className={`${glassInputClass} min-h-[120px] resize-none`} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="สถานที่พบ / สถานที่หาย" value={location} onChange={(e) => setLocation(e.target.value)} className={glassInputClass} />
            <input type="text" placeholder="ช่องทางติดต่อ (เช่น เบอร์โทร, Line)" value={contact} onChange={(e) => setContact(e.target.value)} className={glassInputClass} />
          </div>

          <div className="mb-6 mt-2">
            <label className="block text-sm text-white/50 mb-3 ml-1">อัปโหลดรูปภาพสิ่งของ</label>
            <input
              type="file" accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  const file = e.target.files[0];
                  setImageFile(file);
                  const reader = new FileReader();
                  reader.onloadend = () => setImageBase64(reader.result as string);
                  reader.readAsDataURL(file);
                }
              }}
              className="block w-full text-sm text-white/60 file:mr-4 file:py-2.5 file:px-5 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 hover:file:shadow-lg cursor-pointer transition-all duration-300"
            />
          </div>

          {imageFile && (
            <div className="relative group overflow-hidden rounded-xl border border-white/10 mb-6 animate-fade-in-up">
              <img src={URL.createObjectURL(imageFile)} alt="Preview" className="w-full h-48 md:h-72 object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>
          )}

          <button
            onClick={handlePost}
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-[0_0_25px_rgba(147,51,234,0.5)] active:scale-95 text-white font-bold py-4 px-6 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:scale-100 transition-all duration-300"
          >
            {loading ? "กำลังดำเนินการ..." : isEditing ? "บันทึกการแก้ไข" : "โพสต์ประกาศ"}
          </button>
        </div>

        {/* List Section */}
        <div className="animate-fade-in-up delay-300">
          <h2 className="text-2xl font-bold mb-6 text-white/90">รายการล่าสุด</h2>

          <input
            type="text"
            placeholder="🔍 ค้นหาชื่อสิ่งของ, สถานที่..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`${glassInputClass} mb-8`}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {filteredItems.length === 0 ? (
              <div className="col-span-full text-center text-white/40 py-16 bg-white/[0.02] rounded-2xl border border-white/5 border-dashed">
                <span className="text-4xl mb-3 block">👀</span>
                ยังไม่มีรายการของหายในขณะนี้
              </div>
            ) : (
              filteredItems.map((item, index) => {
                const delayClass = index % 4 === 0 ? 'delay-100' : index % 4 === 1 ? 'delay-200' : index % 4 === 2 ? 'delay-300' : 'delay-400';
                
                return (
                  <div
                    key={item.id}
                    className={`animate-fade-in-up ${delayClass} relative overflow-hidden border border-white/10 rounded-2xl flex flex-col backdrop-blur-md transition-all duration-500 group ${
                      item.found ? "bg-white/[0.02] opacity-60 grayscale-[30%]" : "bg-white/[0.05] hover:bg-white/[0.08] hover:-translate-y-2 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:border-purple-500/30"
                    }`}
                  >
                    {(item.imageUrl || item.image) && (
                      <div className="relative h-48 overflow-hidden">
                        <img
                          src={item.imageUrl || item.image}
                          alt={item.itemName}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                        {item.found && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="bg-emerald-500/80 text-white font-bold px-4 py-2 rounded-full backdrop-blur-sm transform -rotate-12 border border-emerald-400/50 shadow-lg">
                              ✅ ส่งคืนแล้ว
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">
                        {item.itemName}
                      </h3>
                      
                      <p className="text-white/60 text-sm mb-4 line-clamp-2 flex-1">{item.description}</p>
                      
                      <div className="space-y-1.5 text-xs text-white/50 mb-5 bg-black/20 p-3 rounded-lg border border-white/5">
                        <p className="flex items-center"><span className="w-5 text-purple-400">📍</span> {item.location}</p>
                        <p className="flex items-center"><span className="w-5 text-purple-400">📞</span> {item.contact}</p>
                      </div>

                      <div className="pt-4 border-t border-white/10 flex flex-wrap gap-2 justify-between items-center text-[10px] text-white/30">
                        <div>
                          <p>โดย: {item.userEmail.split('@')[0]}</p>
                        </div>

                        {/* Actions */}
                        <div className="flex space-x-2">
                          {item.userEmail === user.email && !item.found && (
                            <button onClick={() => handleMarkAsFound(item.id)} className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 hover:border-emerald-500 py-1.5 px-3 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                              เจอแล้ว
                            </button>
                          )}
                          {item.userEmail === user.email && (
                            <button onClick={() => handleEdit(item)} className="bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white border border-blue-500/30 hover:border-blue-500 py-1.5 px-3 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm hover:shadow-[0_0_15px_rgba(59,130,246,0.4)]">
                              แก้ไข
                            </button>
                          )}
                          {item.userEmail === user.email && (
                            <button onClick={() => handleDelete(item.id)} className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 hover:border-red-500 py-1.5 px-3 rounded-lg transition-all duration-300 hover:scale-105 active:scale-95 shadow-sm hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                              ลบ
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </main>
  );
}