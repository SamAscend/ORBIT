"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";

export const languages = [
  { code: "en", name: "English", direction: "ltr" },
  { code: "id", name: "Bahasa Indonesia", direction: "ltr" },
  { code: "es", name: "Español", direction: "ltr" },
  { code: "pt-BR", name: "Português (Brasil)", direction: "ltr" },
  { code: "fr", name: "Français", direction: "ltr" },
  { code: "de", name: "Deutsch", direction: "ltr" },
  { code: "zh-CN", name: "简体中文", direction: "ltr" },
  { code: "ja", name: "日本語", direction: "ltr" },
  { code: "ko", name: "한국어", direction: "ltr" },
  { code: "ar", name: "العربية", direction: "rtl" },
] as const;

export type Locale = typeof languages[number]["code"];

const english = {
  Language: "Language",
  "A COMMUNITY, IN MOTION": "A COMMUNITY, IN MOTION",
  "Welcome to ORBIT,": "Welcome to ORBIT,",
  "Here are a few good places to start. You can always find them in the menu.": "Here are a few good places to start. You can always find them in the menu.",
  "Got it, let’s go": "Got it, let’s go",
  Close: "Close",
  "Set a goal and reward for your crew.": "Set a goal and reward for your crew.",
  "Bring members together with an event.": "Bring members together with an event.",
  "Share important news with every member.": "Share important news with every member.",
  "See what your ORBIT crew is planning.": "See what your ORBIT crew is planning.",
  "Find members and start a conversation.": "Find members and start a conversation.",
  "Check official news from your ORBIT team.": "Check official news from your ORBIT team.",
  "Find an event": "Find an event",
  "Meet your crew": "Meet your crew",
  "Read crew updates": "Read crew updates",
  "Post an update": "Post an update",
  "Updates will appear here when an admin publishes one.": "Updates will appear here when an admin publishes one.",
  "Create first update": "Create first update",
  "Explore events": "Explore events",
  "Open crew chat": "Open crew chat",
  "Better together.": "Better together.",
  "One step at a time.": "One step at a time.",
  "Find your people, show up for each other, and make every mile mean a little more.": "Find your people, show up for each other, and make every mile mean a little more.",
  "Made for the miles ahead.": "Made for the miles ahead.",
  "PLATFORM ADMINISTRATION": "PLATFORM ADMINISTRATION",
  "WELCOME TO YOUR CREW": "WELCOME TO YOUR CREW",
  "Find your people.": "Find your people.",
  "Reset your password.": "Reset your password.",
  "Admin sign in.": "Admin sign in.",
  "Good to see you.": "Good to see you.",
  "Create your member account and join the ORBIT community.": "Create your member account and join the ORBIT community.",
  "We’ll email you a secure link to choose a new password.": "We’ll email you a secure link to choose a new password.",
  "Sign in with the administrator account provisioned by the platform owner.": "Sign in with the administrator account provisioned by the platform owner.",
  "Sign in to pick up where your crew left off.": "Sign in to pick up where your crew left off.",
  "Back to sign in": "Back to sign in",
  "Account type": "Account type",
  Member: "Member",
  Admin: "Admin",
  "Sign in": "Sign in",
  "Create account": "Create account",
  "Full name": "Full name",
  "How should we call you?": "How should we call you?",
  Username: "Username",
  "Use 3–24 letters, numbers, or underscores.": "Use 3–24 letters, numbers, or underscores.",
  "Email address": "Email address",
  "Use the email from the admin account in Supabase Authentication → Users. “ADMIN” is a profile username, not the sign-in email.": "Use the email from the admin account in Supabase Authentication → Users. “ADMIN” is a profile username, not the sign-in email.",
  Password: "Password",
  "At least 8 characters": "At least 8 characters",
  "Enter your password": "Enter your password",
  "Hide password": "Hide password",
  "Show password": "Show password",
  "After sign-up, confirm your email from the message Supabase sends before signing in.": "After sign-up, confirm your email from the message Supabase sends before signing in.",
  "Resend confirmation email": "Resend confirmation email",
  "Sending…": "Sending…",
  "Connect Supabase to continue": "Connect Supabase to continue",
  "Add the project URL and publishable key to .env.local. See the setup steps in README.": "Add the project URL and publishable key to .env.local. See the setup steps in README.",
  "One moment...": "One moment...",
  "Create member account": "Create member account",
  "Send reset link": "Send reset link",
  "Sign in as admin": "Sign in as admin",
  "Forgot your password?": "Forgot your password?",
  "New around here?": "New around here?",
  "Create a member account": "Create a member account",
  "Admin accounts are created by the platform owner. There is no public admin sign-up.": "Admin accounts are created by the platform owner. There is no public admin sign-up.",
  "By continuing, you agree to use this community respectfully and keep members’ information private.": "By continuing, you agree to use this community respectfully and keep members’ information private.",
  "GOOD THINGS HAPPEN TOGETHER": "GOOD THINGS HAPPEN TOGETHER",
  Overview: "Overview",
  Messages: "Messages",
  Blocked: "Blocked",
  Calendar: "Calendar",
  Events: "Events",
  Quests: "Quests",
  "Quest Review": "Quest Review",
  "My Progress": "My Progress",
  Members: "Members",
  Membership: "Membership",
  Profile: "Profile",
  Chat: "Chat",
  Updates: "Updates",
  Reports: "Reports",
  More: "More",
  Back: "Back",
  "Create events and control their details, visibility, and status.": "Create events and control their details, visibility, and status.",
  "Create event": "Create event",
  "Create an event": "Create an event",
  "Edit event": "Edit event",
  "NEW ORBIT EVENT": "NEW ORBIT EVENT",
  "UPDATE ORBIT EVENT": "UPDATE ORBIT EVENT",
  "Event action failed.": "Event action failed.",
  "Event name": "Event name",
  "Date and time": "Date and time",
  Location: "Location",
  "Capacity (optional)": "Capacity (optional)",
  Visibility: "Visibility",
  "Public to members": "Public to members",
  Private: "Private",
  Status: "Status",
  Description: "Description",
  "Quests & missions": "Quests & missions",
  "Set goals and XP rewards, and control the quest deadline.": "Set goals and XP rewards, and control the quest deadline.",
  "Create quest": "Create quest",
  "Create a quest": "Create a quest",
  "Edit quest": "Edit quest",
  "NEW ORBIT QUEST": "NEW ORBIT QUEST",
  "UPDATE ORBIT QUEST": "UPDATE ORBIT QUEST",
  "Quest action failed.": "Quest action failed.",
  "Quest name": "Quest name",
  "Deadline (optional)": "Deadline (optional)",
  "XP reward": "XP reward",
  Goal: "Goal",
  "Give the crew a challenge.": "Give the crew a challenge.",
  "Create a quest with a goal and XP reward to get started.": "Create a quest with a goal and XP reward to get started.",
  "Admin workspace": "Admin workspace",
  "Your community": "Your community",
  "Platform administrator": "Platform administrator",
  "Crew member": "Crew member",
  "Sign out": "Sign out",
  "Good morning": "Good morning",
  "Good afternoon": "Good afternoon",
  "Good evening": "Good evening",
  Welcome: "Welcome",
  "Here’s a clear view of your ORBIT community.": "Here’s a clear view of your ORBIT community.",
  "Your place in the crew, and everything happening around you.": "Your place in the crew, and everything happening around you.",
  "A well-run community gives everyone room to grow.": "A well-run community gives everyone room to grow.",
  "A crew is just people who keep showing up for each other.": "A crew is just people who keep showing up for each other.",
  "Could not load your workspace.": "Could not load your workspace.",
  "Try again": "Try again",
  "FROM THE ORBIT TEAM": "FROM THE ORBIT TEAM",
  "ORBIT COMMUNITY": "ORBIT COMMUNITY",
  "Community updates": "Community updates",
  "Crew updates": "Crew updates",
  "Share important updates where the whole crew can find them.": "Share important updates where the whole crew can find them.",
  "Official announcements and important news from your ORBIT team.": "Official announcements and important news from your ORBIT team.",
  "New update": "New update",
  "Update failed.": "Update failed.",
  "NEW COMMUNITY UPDATE": "NEW COMMUNITY UPDATE",
  "EDIT COMMUNITY UPDATE": "EDIT COMMUNITY UPDATE",
  "Write an update": "Write an update",
  "Edit update": "Edit update",
  Title: "Title",
  Message: "Message",
  "Publish now": "Publish now",
  "Pin to top": "Pin to top",
  Cancel: "Cancel",
  "Saving…": "Saving…",
  "Save changes": "Save changes",
  "Publish update": "Publish update",
  "Save draft": "Save draft",
  "PUBLISHED & DRAFTS": "PUBLISHED & DRAFTS",
  "LATEST NEWS": "LATEST NEWS",
  "All updates": "All updates",
  "The ORBIT bulletin": "The ORBIT bulletin",
  "Loading updates…": "Loading updates…",
  "No updates yet": "No updates yet",
  "All quiet for now": "All quiet for now",
  "Post an update to give the crew one reliable place for important news.": "Post an update to give the crew one reliable place for important news.",
  "Official ORBIT announcements will show up here.": "Official ORBIT announcements will show up here.",
  PINNED: "PINNED",
  DRAFT: "DRAFT",
  Edit: "Edit",
  Pin: "Pin",
  Unpin: "Unpin",
  Publish: "Publish",
  Unpublish: "Unpublish",
  Delete: "Delete",
  Published: "Published",
  Draft: "Draft",
  "THE ORBIT LOUNGE": "THE ORBIT LOUNGE",
  "Global chat": "Global chat",
  "One shared space for the whole crew and the ORBIT team.": "One shared space for the whole crew and the ORBIT team.",
  Live: "Live",
  "Checking for messages": "Checking for messages",
  Refresh: "Refresh",
  "Refreshing…": "Refreshing…",
  "Clear chat": "Clear chat",
  "Loading the ORBIT conversation…": "Loading the ORBIT conversation…",
  "Start the conversation.": "Start the conversation.",
  "Say hello to your ORBIT community.": "Say hello to your ORBIT community.",
  "Share something with the crew…": "Share something with the crew…",
  "Send message": "Send message",
  "YOUR ORBIT CREW": "YOUR ORBIT CREW",
  "Meet the crew, see who’s around, and start a private conversation.": "Meet the crew, see who’s around, and start a private conversation.",
  "Show my online status": "Show my online status",
  "Only active ORBIT members can see it.": "Only active ORBIT members can see it.",
  "Member directory": "Member directory",
  "Member lists": "Member lists",
  "Search members": "Search members",
  "Loading your ORBIT crew…": "Loading your ORBIT crew…",
  "No conversations yet. Choose someone in the crew to say hello.": "No conversations yet. Choose someone in the crew to say hello.",
  "You haven’t blocked anyone.": "You haven’t blocked anyone.",
  "No members match that search.": "No members match that search.",
  "Status hidden": "Status hidden",
  Online: "Online",
  Offline: "Offline",
  Unblock: "Unblock",
  Open: "Open",
  "Say hello": "Say hello",
  "Member interaction failed.": "Member interaction failed.",
  Dismiss: "Dismiss",
  "Choose a new password.": "Choose a new password.",
  "Create a new password for your ORBIT account.": "Create a new password for your ORBIT account.",
  "New password": "New password",
  "Confirm new password": "Confirm new password",
  "Update password": "Update password",
  "Return to sign in": "Return to sign in",
} as const;

type TranslationKey = keyof typeof english;
type TranslationPack = Partial<Record<TranslationKey, string>>;

const translations: Record<Locale, TranslationPack> = {
  en: english,
  id: {
    "By continuing, you agree to use this community respectfully and keep members’ information private.": "Dengan melanjutkan, kamu setuju untuk menghormati komunitas ini dan menjaga privasi anggota.",
    "GOOD THINGS HAPPEN TOGETHER": "HAL BAIK TERJADI BERSAMA",
    Language: "Bahasa", "A COMMUNITY, IN MOTION": "KOMUNITAS YANG TERUS BERGERAK", "Better together.": "Lebih baik bersama.", "One step at a time.": "Selangkah demi selangkah.", "Find your people, show up for each other, and make every mile mean a little more.": "Temukan teman seperjalanan, saling hadir, dan buat setiap langkah jadi lebih berarti.", "Made for the miles ahead.": "Untuk perjalanan yang menanti.", "PLATFORM ADMINISTRATION": "ADMINISTRASI PLATFORM", "WELCOME TO YOUR CREW": "SELAMAT DATANG DI KRU", "Find your people.": "Temukan teman seperjalanan.", "Reset your password.": "Atur ulang kata sandi.", "Admin sign in.": "Masuk sebagai admin.", "Good to see you.": "Senang bertemu lagi.", "Create your member account and join the ORBIT community.": "Buat akun anggota dan bergabung dengan komunitas ORBIT.", "We’ll email you a secure link to choose a new password.": "Kami akan mengirim tautan aman untuk membuat kata sandi baru.", "Sign in with the administrator account provisioned by the platform owner.": "Masuk dengan akun administrator yang dibuat oleh pemilik platform.", "Sign in to pick up where your crew left off.": "Masuk kembali dan lanjutkan perjalanan bersama kru.", "Back to sign in": "Kembali ke halaman masuk", "Account type": "Jenis akun", Member: "Anggota", Admin: "Admin", "Sign in": "Masuk", "Create account": "Buat akun", "Full name": "Nama lengkap", "How should we call you?": "Nama yang ingin digunakan?", Username: "Nama pengguna", "Use 3–24 letters, numbers, or underscores.": "Gunakan 3–24 huruf, angka, atau garis bawah.", "Email address": "Alamat email", Password: "Kata sandi", "At least 8 characters": "Minimal 8 karakter", "Enter your password": "Masukkan kata sandi", "Hide password": "Sembunyikan kata sandi", "Show password": "Tampilkan kata sandi", "Resend confirmation email": "Kirim ulang email konfirmasi", "Sending…": "Mengirim…", "Connect Supabase to continue": "Hubungkan Supabase untuk melanjutkan", "One moment...": "Tunggu sebentar...", "Create member account": "Buat akun anggota", "Send reset link": "Kirim tautan pengaturan ulang", "Sign in as admin": "Masuk sebagai admin", "Forgot your password?": "Lupa kata sandi?", "New around here?": "Baru di sini?", "Create a member account": "Buat akun anggota", Cancel: "Batal", "Saving…": "Menyimpan…", "Save changes": "Simpan perubahan", "Publish update": "Terbitkan pengumuman", "Save draft": "Simpan draf", Title: "Judul", Message: "Pesan", "Publish now": "Terbitkan sekarang", "Pin to top": "Sematkan di atas", "No updates yet": "Belum ada pengumuman", "All quiet for now": "Belum ada kabar baru", "No members match that search.": "Tidak ada anggota yang cocok dengan pencarian.", "Good morning": "Selamat pagi", "Good afternoon": "Selamat siang", "Good evening": "Selamat malam", Welcome: "Selamat datang", Overview: "Ringkasan", Calendar: "Kalender", Events: "Acara", Quests: "Misi", "Quest Review": "Tinjauan Misi", "My Progress": "Progres Saya", Members: "Anggota", Membership: "Keanggotaan", Profile: "Profil", Chat: "Obrolan", Updates: "Pengumuman", Reports: "Laporan", More: "Lainnya", Back: "Kembali", "Admin workspace": "Ruang kerja admin", "Your community": "Komunitasmu", "Platform administrator": "Administrator platform", "Crew member": "Anggota kru", "Sign out": "Keluar", "Here’s a clear view of your ORBIT community.": "Lihat perkembangan komunitas ORBIT dengan jelas.", "Your place in the crew, and everything happening around you.": "Tempatmu di dalam kru dan semua hal yang sedang berlangsung.", "A well-run community gives everyone room to grow.": "Komunitas yang terkelola baik memberi ruang bagi semua untuk berkembang.", "A crew is just people who keep showing up for each other.": "Kru adalah orang-orang yang terus hadir untuk satu sama lain.", "Could not load your workspace.": "Ruang kerja gagal dimuat.", "Try again": "Coba lagi", "FROM THE ORBIT TEAM": "DARI TIM ORBIT", "ORBIT COMMUNITY": "KOMUNITAS ORBIT", "Community updates": "Pengumuman komunitas", "Crew updates": "Kabar kru", "Share important updates where the whole crew can find them.": "Bagikan kabar penting agar mudah ditemukan seluruh kru.", "Official announcements and important news from your ORBIT team.": "Pengumuman resmi dan kabar penting dari tim ORBIT.", "New update": "Pengumuman baru", "Update failed.": "Pengumuman gagal diproses.", "NEW COMMUNITY UPDATE": "PENGUMUMAN KOMUNITAS BARU", "EDIT COMMUNITY UPDATE": "EDIT PENGUMUMAN KOMUNITAS", "Write an update": "Tulis pengumuman", "Edit update": "Edit pengumuman", "PUBLISHED & DRAFTS": "DITERBITKAN & DRAF", "LATEST NEWS": "KABAR TERBARU", "All updates": "Semua pengumuman", "The ORBIT bulletin": "Papan kabar ORBIT", "Loading updates…": "Memuat pengumuman…", "Post an update to give the crew one reliable place for important news.": "Buat pengumuman agar kru punya satu tempat tepercaya untuk kabar penting.", "Official ORBIT announcements will show up here.": "Pengumuman resmi ORBIT akan muncul di sini.", PINNED: "DISEMATKAN", DRAFT: "DRAF", Edit: "Edit", Pin: "Sematkan", Unpin: "Lepas sematan", Publish: "Terbitkan", Unpublish: "Tarik", Delete: "Hapus", Published: "Diterbitkan", Draft: "Draf", "THE ORBIT LOUNGE": "RUANG SANTAI ORBIT", "Global chat": "Obrolan global", "One shared space for the whole crew and the ORBIT team.": "Ruang bersama untuk seluruh kru dan tim ORBIT.", Live: "Langsung", "Checking for messages": "Memeriksa pesan", Refresh: "Muat ulang", "Refreshing…": "Memuat ulang…", "Clear chat": "Hapus obrolan", "Start the conversation.": "Mulai percakapan.", "Say hello to your ORBIT community.": "Sapa komunitas ORBIT-mu.", "Share something with the crew…": "Bagikan sesuatu kepada kru…", "Send message": "Kirim pesan", "YOUR ORBIT CREW": "KRU ORBIT-MU", "Meet the crew, see who’s around, and start a private conversation.": "Kenali kru, lihat siapa yang sedang aktif, dan mulai percakapan pribadi.", "Show my online status": "Tampilkan status online saya", "Only active ORBIT members can see it.": "Hanya anggota ORBIT aktif yang dapat melihatnya.", "Member directory": "Direktori anggota", "Member lists": "Daftar anggota", "Search members": "Cari anggota", "Loading your ORBIT crew…": "Memuat kru ORBIT…", "No conversations yet. Choose someone in the crew to say hello.": "Belum ada percakapan. Pilih seseorang di kru untuk menyapa.", "You haven’t blocked anyone.": "Kamu belum memblokir siapa pun.", "Status hidden": "Status disembunyikan", Online: "Online", Offline: "Offline", Unblock: "Buka blokir", Open: "Buka", "Say hello": "Sapa", "Member interaction failed.": "Interaksi anggota gagal.", Dismiss: "Tutup", "Choose a new password.": "Pilih kata sandi baru.", "Create a new password for your ORBIT account.": "Buat kata sandi baru untuk akun ORBIT-mu.", "New password": "Kata sandi baru", "Confirm new password": "Konfirmasi kata sandi baru", "Update password": "Perbarui kata sandi", "Return to sign in": "Kembali ke halaman masuk",
  },
  es: {
    "By continuing, you agree to use this community respectfully and keep members’ information private.": "Al continuar, aceptas respetar esta comunidad y mantener privada la información de sus miembros.",
    "GOOD THINGS HAPPEN TOGETHER": "JUNTOS SUCEDEN COSAS BUENAS",
    Language: "Idioma", "A COMMUNITY, IN MOTION": "UNA COMUNIDAD EN MOVIMIENTO", "Better together.": "Mejor en equipo.", "One step at a time.": "Paso a paso.", "Find your people, show up for each other, and make every mile mean a little more.": "Encuentra a tu gente, apóyense y haz que cada kilómetro cuente.", "Made for the miles ahead.": "Hecho para el camino que nos espera.", "PLATFORM ADMINISTRATION": "ADMINISTRACIÓN DE LA PLATAFORMA", "WELCOME TO YOUR CREW": "TE DAMOS LA BIENVENIDA AL EQUIPO", "Find your people.": "Encuentra a tu gente.", "Reset your password.": "Restablece tu contraseña.", "Admin sign in.": "Acceso de administración.", "Good to see you.": "Qué bueno verte.", "Create your member account and join the ORBIT community.": "Crea tu cuenta de miembro y únete a la comunidad ORBIT.", "We’ll email you a secure link to choose a new password.": "Te enviaremos un enlace seguro para elegir una contraseña nueva.", "Sign in with the administrator account provisioned by the platform owner.": "Inicia sesión con la cuenta de administrador creada por el propietario de la plataforma.", "Sign in to pick up where your crew left off.": "Inicia sesión y continúa donde lo dejó tu equipo.", "Back to sign in": "Volver al inicio de sesión", "Account type": "Tipo de cuenta", Member: "Miembro", Admin: "Admin", "Sign in": "Iniciar sesión", "Create account": "Crear cuenta", "Full name": "Nombre completo", "How should we call you?": "¿Cómo te llamamos?", Username: "Nombre de usuario", "Email address": "Correo electrónico", Password: "Contraseña", "At least 8 characters": "Al menos 8 caracteres", "Enter your password": "Introduce tu contraseña", "Hide password": "Ocultar contraseña", "Show password": "Mostrar contraseña", "Resend confirmation email": "Reenviar correo de confirmación", "Sending…": "Enviando…", "Connect Supabase to continue": "Conecta Supabase para continuar", "One moment...": "Un momento...", "Create member account": "Crear cuenta de miembro", "Send reset link": "Enviar enlace de restablecimiento", "Sign in as admin": "Acceder como admin", "Forgot your password?": "¿Olvidaste tu contraseña?", "New around here?": "¿Eres nuevo por aquí?", "Create a member account": "Crear una cuenta de miembro", "Good morning": "Buenos días", "Good afternoon": "Buenas tardes", "Good evening": "Buenas noches", Welcome: "Te damos la bienvenida", Overview: "Resumen", Calendar: "Calendario", Events: "Eventos", Quests: "Misiones", "Quest Review": "Revisión de misiones", "My Progress": "Mi progreso", Members: "Miembros", Membership: "Membresía", Profile: "Perfil", Chat: "Chat", Updates: "Novedades", Reports: "Informes", More: "Más", Back: "Volver", "Admin workspace": "Panel de administración", "Your community": "Tu comunidad", "Platform administrator": "Administrador de la plataforma", "Crew member": "Miembro del equipo", "Sign out": "Cerrar sesión", "Could not load your workspace.": "No se pudo cargar el espacio de trabajo.", "Try again": "Volver a intentarlo", "FROM THE ORBIT TEAM": "DEL EQUIPO ORBIT", "ORBIT COMMUNITY": "COMUNIDAD ORBIT", "Community updates": "Novedades de la comunidad", "Crew updates": "Novedades del equipo", "Share important updates where the whole crew can find them.": "Comparte novedades importantes en un lugar accesible para todo el equipo.", "Official announcements and important news from your ORBIT team.": "Anuncios oficiales y noticias importantes del equipo ORBIT.", "New update": "Nueva novedad", "Update failed.": "No se pudo guardar la novedad.", "NEW COMMUNITY UPDATE": "NUEVA NOVEDAD DE LA COMUNIDAD", "EDIT COMMUNITY UPDATE": "EDITAR NOVEDAD DE LA COMUNIDAD", "Write an update": "Escribe una novedad", "Edit update": "Editar novedad", Title: "Título", Message: "Mensaje", "Publish now": "Publicar ahora", "Pin to top": "Fijar arriba", Cancel: "Cancelar", "Saving…": "Guardando…", "Save changes": "Guardar cambios", "Publish update": "Publicar novedad", "Save draft": "Guardar borrador", "PUBLISHED & DRAFTS": "PUBLICADAS Y BORRADORES", "LATEST NEWS": "ÚLTIMAS NOTICIAS", "All updates": "Todas las novedades", "The ORBIT bulletin": "El tablón de ORBIT", "Loading updates…": "Cargando novedades…", "No updates yet": "Aún no hay novedades", "All quiet for now": "Por ahora, todo tranquilo", "Post an update to give the crew one reliable place for important news.": "Publica una novedad para que el equipo tenga un lugar fiable con información importante.", "Official ORBIT announcements will show up here.": "Los anuncios oficiales de ORBIT aparecerán aquí.", PINNED: "FIJADO", DRAFT: "BORRADOR", Edit: "Editar", Pin: "Fijar", Unpin: "Desfijar", Publish: "Publicar", Unpublish: "Retirar", Delete: "Eliminar", Published: "Publicado", Draft: "Borrador", "THE ORBIT LOUNGE": "EL ESPACIO ORBIT", "Global chat": "Chat global", "One shared space for the whole crew and the ORBIT team.": "Un espacio compartido para todo el equipo y ORBIT.", Live: "En directo", "Checking for messages": "Buscando mensajes", Refresh: "Actualizar", "Refreshing…": "Actualizando…", "Clear chat": "Borrar chat", "Start the conversation.": "Inicia la conversación.", "Say hello to your ORBIT community.": "Saluda a tu comunidad ORBIT.", "Share something with the crew…": "Comparte algo con el equipo…", "Send message": "Enviar mensaje", "YOUR ORBIT CREW": "TU EQUIPO ORBIT", "Meet the crew, see who’s around, and start a private conversation.": "Conoce al equipo, mira quién está conectado e inicia una conversación privada.", "Show my online status": "Mostrar mi estado en línea", "Only active ORBIT members can see it.": "Solo los miembros activos de ORBIT pueden verlo.", "Member directory": "Directorio de miembros", "Member lists": "Listas de miembros", "Search members": "Buscar miembros", "Loading your ORBIT crew…": "Cargando tu equipo ORBIT…", "No conversations yet. Choose someone in the crew to say hello.": "Aún no hay conversaciones. Elige a alguien del equipo para saludar.", "You haven’t blocked anyone.": "No has bloqueado a nadie.", "Status hidden": "Estado oculto", Online: "En línea", Offline: "Desconectado", Unblock: "Desbloquear", Open: "Abrir", "Say hello": "Saludar", "Member interaction failed.": "Error en la interacción con miembros.", Dismiss: "Cerrar", "Choose a new password.": "Elige una contraseña nueva.", "Create a new password for your ORBIT account.": "Crea una contraseña nueva para tu cuenta ORBIT.", "New password": "Contraseña nueva", "Confirm new password": "Confirmar contraseña nueva", "Update password": "Actualizar contraseña", "Return to sign in": "Volver al inicio de sesión",
  },
  "pt-BR": {
    "By continuing, you agree to use this community respectfully and keep members’ information private.": "Ao continuar, você concorda em respeitar esta comunidade e manter privadas as informações dos membros.",
    "GOOD THINGS HAPPEN TOGETHER": "JUNTOS, COISAS BOAS ACONTECEM",
    Language: "Idioma", "A COMMUNITY, IN MOTION": "UMA COMUNIDADE EM MOVIMENTO", "Better together.": "Melhor juntos.", "One step at a time.": "Um passo de cada vez.", "Find your people, show up for each other, and make every mile mean a little more.": "Encontre sua turma, esteja presente e dê mais significado a cada caminho.", "Made for the miles ahead.": "Feito para o caminho que vem pela frente.", "PLATFORM ADMINISTRATION": "ADMINISTRAÇÃO DA PLATAFORMA", "WELCOME TO YOUR CREW": "BOAS-VINDAS À SUA TURMA", "Find your people.": "Encontre sua turma.", "Reset your password.": "Redefina sua senha.", "Admin sign in.": "Acesso de administrador.", "Good to see you.": "Que bom ver você.", "Create your member account and join the ORBIT community.": "Crie sua conta de membro e participe da comunidade ORBIT.", "We’ll email you a secure link to choose a new password.": "Enviaremos um link seguro para você escolher uma nova senha.", "Sign in with the administrator account provisioned by the platform owner.": "Entre com a conta de administrador criada pelo proprietário da plataforma.", "Sign in to pick up where your crew left off.": "Entre e continue de onde sua turma parou.", "Back to sign in": "Voltar para entrar", "Account type": "Tipo de conta", Member: "Membro", Admin: "Admin", "Sign in": "Entrar", "Create account": "Criar conta", "Full name": "Nome completo", "How should we call you?": "Como podemos chamar você?", Username: "Nome de usuário", "Email address": "Endereço de e-mail", Password: "Senha", "At least 8 characters": "Pelo menos 8 caracteres", "Enter your password": "Digite sua senha", "Hide password": "Ocultar senha", "Show password": "Mostrar senha", "Resend confirmation email": "Reenviar e-mail de confirmação", "Sending…": "Enviando…", "Connect Supabase to continue": "Conecte o Supabase para continuar", "One moment...": "Só um instante...", "Create member account": "Criar conta de membro", "Send reset link": "Enviar link de redefinição", "Sign in as admin": "Entrar como admin", "Forgot your password?": "Esqueceu sua senha?", "New around here?": "É novo por aqui?", "Create a member account": "Criar uma conta de membro", "Good morning": "Bom dia", "Good afternoon": "Boa tarde", "Good evening": "Boa noite", Welcome: "Boas-vindas", Overview: "Visão geral", Calendar: "Calendário", Events: "Eventos", Quests: "Missões", "Quest Review": "Revisão de missões", "My Progress": "Meu progresso", Members: "Membros", Membership: "Associação", Profile: "Perfil", Chat: "Chat", Updates: "Novidades", Reports: "Denúncias", More: "Mais", Back: "Voltar", "Admin workspace": "Área do administrador", "Your community": "Sua comunidade", "Platform administrator": "Administrador da plataforma", "Crew member": "Membro da turma", "Sign out": "Sair", "Could not load your workspace.": "Não foi possível carregar sua área de trabalho.", "Try again": "Tentar novamente", "FROM THE ORBIT TEAM": "DA EQUIPE ORBIT", "ORBIT COMMUNITY": "COMUNIDADE ORBIT", "Community updates": "Novidades da comunidade", "Crew updates": "Novidades da turma", "Share important updates where the whole crew can find them.": "Compartilhe novidades importantes em um lugar fácil de encontrar.", "Official announcements and important news from your ORBIT team.": "Anúncios oficiais e notícias importantes da equipe ORBIT.", "New update": "Nova novidade", "Update failed.": "Não foi possível processar a novidade.", "NEW COMMUNITY UPDATE": "NOVA NOVIDADE DA COMUNIDADE", "EDIT COMMUNITY UPDATE": "EDITAR NOVIDADE DA COMUNIDADE", "Write an update": "Escreva uma novidade", "Edit update": "Editar novidade", Title: "Título", Message: "Mensagem", "Publish now": "Publicar agora", "Pin to top": "Fixar no topo", Cancel: "Cancelar", "Saving…": "Salvando…", "Save changes": "Salvar alterações", "Publish update": "Publicar novidade", "Save draft": "Salvar rascunho", "PUBLISHED & DRAFTS": "PUBLICADAS E RASCUNHOS", "LATEST NEWS": "ÚLTIMAS NOTÍCIAS", "All updates": "Todas as novidades", "The ORBIT bulletin": "Mural ORBIT", "Loading updates…": "Carregando novidades…", "No updates yet": "Ainda não há novidades", "All quiet for now": "Tudo tranquilo por enquanto", "Post an update to give the crew one reliable place for important news.": "Publique uma novidade para reunir informações importantes em um só lugar.", "Official ORBIT announcements will show up here.": "Os anúncios oficiais da ORBIT aparecerão aqui.", PINNED: "FIXADO", DRAFT: "RASCUNHO", Edit: "Editar", Pin: "Fixar", Unpin: "Desafixar", Publish: "Publicar", Unpublish: "Retirar", Delete: "Excluir", Published: "Publicado", Draft: "Rascunho", "THE ORBIT LOUNGE": "ESPAÇO ORBIT", "Global chat": "Chat global", "One shared space for the whole crew and the ORBIT team.": "Um espaço compartilhado por toda a turma e pela equipe ORBIT.", Live: "Ao vivo", "Checking for messages": "Verificando mensagens", Refresh: "Atualizar", "Refreshing…": "Atualizando…", "Clear chat": "Limpar chat", "Start the conversation.": "Comece a conversa.", "Say hello to your ORBIT community.": "Dê oi para a comunidade ORBIT.", "Share something with the crew…": "Compartilhe algo com a turma…", "Send message": "Enviar mensagem", "YOUR ORBIT CREW": "SUA TURMA ORBIT", "Meet the crew, see who’s around, and start a private conversation.": "Conheça a turma, veja quem está por aqui e comece uma conversa privada.", "Show my online status": "Mostrar meu status online", "Only active ORBIT members can see it.": "Somente membros ativos da ORBIT podem ver.", "Member directory": "Diretório de membros", "Member lists": "Listas de membros", "Search members": "Buscar membros", "Loading your ORBIT crew…": "Carregando sua turma ORBIT…", "No conversations yet. Choose someone in the crew to say hello.": "Ainda não há conversas. Escolha alguém da turma para dar oi.", "You haven’t blocked anyone.": "Você ainda não bloqueou ninguém.", "Status hidden": "Status oculto", Online: "Online", Offline: "Offline", Unblock: "Desbloquear", Open: "Abrir", "Say hello": "Dizer oi", "Member interaction failed.": "Falha na interação com membros.", Dismiss: "Fechar", "Choose a new password.": "Escolha uma nova senha.", "Create a new password for your ORBIT account.": "Crie uma nova senha para sua conta ORBIT.", "New password": "Nova senha", "Confirm new password": "Confirme a nova senha", "Update password": "Atualizar senha", "Return to sign in": "Voltar para entrar",
  },
  fr: {
    "By continuing, you agree to use this community respectfully and keep members’ information private.": "En continuant, vous acceptez de respecter cette communauté et de préserver la confidentialité des membres.",
    "GOOD THINGS HAPPEN TOGETHER": "ENSEMBLE, DE BELLES CHOSES ARRIVENT",
    Language: "Langue", "A COMMUNITY, IN MOTION": "UNE COMMUNAUTÉ EN MOUVEMENT", "Better together.": "Ensemble, c’est mieux.", "One step at a time.": "Un pas après l’autre.", "Find your people, show up for each other, and make every mile mean a little more.": "Trouvez votre équipe, soyez là les uns pour les autres et donnez plus de sens à chaque kilomètre.", "Made for the miles ahead.": "Pour la route qui nous attend.", "PLATFORM ADMINISTRATION": "ADMINISTRATION DE LA PLATEFORME", "WELCOME TO YOUR CREW": "BIENVENUE DANS VOTRE ÉQUIPE", "Find your people.": "Trouvez votre équipe.", "Reset your password.": "Réinitialisez votre mot de passe.", "Admin sign in.": "Connexion administrateur.", "Good to see you.": "Ravi de vous revoir.", "Create your member account and join the ORBIT community.": "Créez votre compte membre et rejoignez la communauté ORBIT.", "We’ll email you a secure link to choose a new password.": "Nous vous enverrons un lien sécurisé pour choisir un nouveau mot de passe.", "Sign in with the administrator account provisioned by the platform owner.": "Connectez-vous avec le compte administrateur créé par le propriétaire de la plateforme.", "Sign in to pick up where your crew left off.": "Connectez-vous pour reprendre là où votre équipe s’est arrêtée.", "Back to sign in": "Retour à la connexion", "Account type": "Type de compte", Member: "Membre", Admin: "Admin", "Sign in": "Se connecter", "Create account": "Créer un compte", "Full name": "Nom complet", "How should we call you?": "Comment devons-nous vous appeler ?", Username: "Nom d’utilisateur", "Email address": "Adresse e-mail", Password: "Mot de passe", "At least 8 characters": "8 caractères minimum", "Enter your password": "Saisissez votre mot de passe", "Hide password": "Masquer le mot de passe", "Show password": "Afficher le mot de passe", "Resend confirmation email": "Renvoyer l’e-mail de confirmation", "Sending…": "Envoi…", "Connect Supabase to continue": "Connectez Supabase pour continuer", "One moment...": "Un instant...", "Create member account": "Créer un compte membre", "Send reset link": "Envoyer le lien de réinitialisation", "Sign in as admin": "Se connecter en tant qu’admin", "Forgot your password?": "Mot de passe oublié ?", "New around here?": "Vous êtes nouveau ici ?", "Create a member account": "Créer un compte membre", "Good morning": "Bonjour", "Good afternoon": "Bon après-midi", "Good evening": "Bonsoir", Welcome: "Bienvenue", Overview: "Vue d’ensemble", Calendar: "Calendrier", Events: "Événements", Quests: "Défis", "Quest Review": "Validation des défis", "My Progress": "Ma progression", Members: "Membres", Membership: "Adhésion", Profile: "Profil", Chat: "Discussion", Updates: "Actualités", Reports: "Signalements", More: "Plus", Back: "Retour", "Admin workspace": "Espace administration", "Your community": "Votre communauté", "Platform administrator": "Administrateur de la plateforme", "Crew member": "Membre de l’équipe", "Sign out": "Se déconnecter", "Could not load your workspace.": "Impossible de charger votre espace.", "Try again": "Réessayer", "FROM THE ORBIT TEAM": "DE L’ÉQUIPE ORBIT", "ORBIT COMMUNITY": "COMMUNAUTÉ ORBIT", "Community updates": "Actualités de la communauté", "Crew updates": "Actualités de l’équipe", "Share important updates where the whole crew can find them.": "Partagez les informations importantes à un endroit accessible à toute l’équipe.", "Official announcements and important news from your ORBIT team.": "Annonces officielles et informations importantes de l’équipe ORBIT.", "New update": "Nouvelle actualité", "Update failed.": "Échec de l’actualité.", "NEW COMMUNITY UPDATE": "NOUVELLE ACTUALITÉ DE LA COMMUNAUTÉ", "EDIT COMMUNITY UPDATE": "MODIFIER L’ACTUALITÉ", "Write an update": "Rédiger une actualité", "Edit update": "Modifier l’actualité", Title: "Titre", Message: "Message", "Publish now": "Publier maintenant", "Pin to top": "Épingler en haut", Cancel: "Annuler", "Saving…": "Enregistrement…", "Save changes": "Enregistrer les modifications", "Publish update": "Publier l’actualité", "Save draft": "Enregistrer le brouillon", "PUBLISHED & DRAFTS": "PUBLICATIONS ET BROUILLONS", "LATEST NEWS": "DERNIÈRES ACTUALITÉS", "All updates": "Toutes les actualités", "The ORBIT bulletin": "Le fil ORBIT", "Loading updates…": "Chargement des actualités…", "No updates yet": "Aucune actualité pour le moment", "All quiet for now": "Rien de nouveau pour le moment", "Post an update to give the crew one reliable place for important news.": "Publiez une actualité pour réunir les informations importantes en un seul endroit.", "Official ORBIT announcements will show up here.": "Les annonces officielles d’ORBIT apparaîtront ici.", PINNED: "ÉPINGLÉ", DRAFT: "BROUILLON", Edit: "Modifier", Pin: "Épingler", Unpin: "Désépingler", Publish: "Publier", Unpublish: "Dépublier", Delete: "Supprimer", Published: "Publié", Draft: "Brouillon", "THE ORBIT LOUNGE": "LE SALON ORBIT", "Global chat": "Discussion générale", "One shared space for the whole crew and the ORBIT team.": "Un espace commun à toute l’équipe et à ORBIT.", Live: "En direct", "Checking for messages": "Recherche de messages", Refresh: "Actualiser", "Refreshing…": "Actualisation…", "Clear chat": "Effacer la discussion", "Start the conversation.": "Lancez la discussion.", "Say hello to your ORBIT community.": "Saluez votre communauté ORBIT.", "Share something with the crew…": "Partagez quelque chose avec l’équipe…", "Send message": "Envoyer le message", "YOUR ORBIT CREW": "VOTRE ÉQUIPE ORBIT", "Meet the crew, see who’s around, and start a private conversation.": "Rencontrez l’équipe, voyez qui est en ligne et démarrez une conversation privée.", "Show my online status": "Afficher mon statut en ligne", "Only active ORBIT members can see it.": "Seuls les membres actifs d’ORBIT peuvent le voir.", "Member directory": "Annuaire des membres", "Member lists": "Listes des membres", "Search members": "Rechercher des membres", "Loading your ORBIT crew…": "Chargement de votre équipe ORBIT…", "No conversations yet. Choose someone in the crew to say hello.": "Aucune conversation. Choisissez quelqu’un dans l’équipe pour le saluer.", "You haven’t blocked anyone.": "Vous n’avez bloqué personne.", "Status hidden": "Statut masqué", Online: "En ligne", Offline: "Hors ligne", Unblock: "Débloquer", Open: "Ouvrir", "Say hello": "Dire bonjour", "Member interaction failed.": "Échec de l’interaction avec les membres.", Dismiss: "Fermer", "Choose a new password.": "Choisissez un nouveau mot de passe.", "Create a new password for your ORBIT account.": "Créez un nouveau mot de passe pour votre compte ORBIT.", "New password": "Nouveau mot de passe", "Confirm new password": "Confirmer le nouveau mot de passe", "Update password": "Mettre à jour le mot de passe", "Return to sign in": "Retour à la connexion",
  },
  de: {
    "By continuing, you agree to use this community respectfully and keep members’ information private.": "Wenn du fortfährst, respektierst du diese Community und schützt die Privatsphäre ihrer Mitglieder.",
    "GOOD THINGS HAPPEN TOGETHER": "GEMEINSAM GESCHIEHEN GUTE DINGE",
    Language: "Sprache", "A COMMUNITY, IN MOTION": "EINE GEMEINSCHAFT IN BEWEGUNG", "Better together.": "Gemeinsam besser.", "One step at a time.": "Schritt für Schritt.", "Find your people, show up for each other, and make every mile mean a little more.": "Finde deine Leute, seid füreinander da und gib jedem Kilometer mehr Bedeutung.", "Made for the miles ahead.": "Für alles, was vor uns liegt.", "PLATFORM ADMINISTRATION": "PLATTFORMVERWALTUNG", "WELCOME TO YOUR CREW": "WILLKOMMEN IN DEINER CREW", "Find your people.": "Finde deine Leute.", "Reset your password.": "Setze dein Passwort zurück.", "Admin sign in.": "Admin-Anmeldung.", "Good to see you.": "Schön, dich zu sehen.", "Create your member account and join the ORBIT community.": "Erstelle dein Mitgliedskonto und tritt der ORBIT-Community bei.", "We’ll email you a secure link to choose a new password.": "Wir senden dir einen sicheren Link, über den du ein neues Passwort festlegen kannst.", "Sign in with the administrator account provisioned by the platform owner.": "Melde dich mit dem Administratorkonto an, das vom Plattforminhaber eingerichtet wurde.", "Sign in to pick up where your crew left off.": "Melde dich an und mach dort weiter, wo deine Crew aufgehört hat.", "Back to sign in": "Zurück zur Anmeldung", "Account type": "Kontotyp", Member: "Mitglied", Admin: "Admin", "Sign in": "Anmelden", "Create account": "Konto erstellen", "Full name": "Vollständiger Name", "How should we call you?": "Wie sollen wir dich nennen?", Username: "Benutzername", "Email address": "E-Mail-Adresse", Password: "Passwort", "At least 8 characters": "Mindestens 8 Zeichen", "Enter your password": "Passwort eingeben", "Hide password": "Passwort ausblenden", "Show password": "Passwort anzeigen", "Resend confirmation email": "Bestätigungs-E-Mail erneut senden", "Sending…": "Wird gesendet…", "Connect Supabase to continue": "Verbinde Supabase, um fortzufahren", "One moment...": "Einen Moment...", "Create member account": "Mitgliedskonto erstellen", "Send reset link": "Link zum Zurücksetzen senden", "Sign in as admin": "Als Admin anmelden", "Forgot your password?": "Passwort vergessen?", "New around here?": "Neu hier?", "Create a member account": "Mitgliedskonto erstellen", "Good morning": "Guten Morgen", "Good afternoon": "Guten Tag", "Good evening": "Guten Abend", Welcome: "Willkommen", Overview: "Übersicht", Calendar: "Kalender", Events: "Veranstaltungen", Quests: "Aufgaben", "Quest Review": "Aufgabenprüfung", "My Progress": "Mein Fortschritt", Members: "Mitglieder", Membership: "Mitgliedschaft", Profile: "Profil", Chat: "Chat", Updates: "Neuigkeiten", Reports: "Meldungen", More: "Mehr", Back: "Zurück", "Admin workspace": "Adminbereich", "Your community": "Deine Community", "Platform administrator": "Plattformadministrator", "Crew member": "Crewmitglied", "Sign out": "Abmelden", "Could not load your workspace.": "Dein Arbeitsbereich konnte nicht geladen werden.", "Try again": "Erneut versuchen", "FROM THE ORBIT TEAM": "VOM ORBIT-TEAM", "ORBIT COMMUNITY": "ORBIT-COMMUNITY", "Community updates": "Community-Neuigkeiten", "Crew updates": "Crew-Neuigkeiten", "Share important updates where the whole crew can find them.": "Teile wichtige Neuigkeiten an einem Ort, den die ganze Crew findet.", "Official announcements and important news from your ORBIT team.": "Offizielle Ankündigungen und wichtige Neuigkeiten vom ORBIT-Team.", "New update": "Neue Neuigkeit", "Update failed.": "Neuigkeit konnte nicht gespeichert werden.", "NEW COMMUNITY UPDATE": "NEUE COMMUNITY-NEUIGKEIT", "EDIT COMMUNITY UPDATE": "COMMUNITY-NEUIGKEIT BEARBEITEN", "Write an update": "Neuigkeit verfassen", "Edit update": "Neuigkeit bearbeiten", Title: "Titel", Message: "Nachricht", "Publish now": "Jetzt veröffentlichen", "Pin to top": "Oben anheften", Cancel: "Abbrechen", "Saving…": "Wird gespeichert…", "Save changes": "Änderungen speichern", "Publish update": "Neuigkeit veröffentlichen", "Save draft": "Entwurf speichern", "PUBLISHED & DRAFTS": "VERÖFFENTLICHT UND ENTWÜRFE", "LATEST NEWS": "NEUESTE NEUIGKEITEN", "All updates": "Alle Neuigkeiten", "The ORBIT bulletin": "ORBIT-Nachrichten", "Loading updates…": "Neuigkeiten werden geladen…", "No updates yet": "Noch keine Neuigkeiten", "All quiet for now": "Im Moment gibt es nichts Neues", "Post an update to give the crew one reliable place for important news.": "Veröffentliche Neuigkeiten, damit wichtige Informationen an einem verlässlichen Ort stehen.", "Official ORBIT announcements will show up here.": "Offizielle ORBIT-Ankündigungen erscheinen hier.", PINNED: "ANGEHEFTET", DRAFT: "ENTWURF", Edit: "Bearbeiten", Pin: "Anheften", Unpin: "Lösen", Publish: "Veröffentlichen", Unpublish: "Zurückziehen", Delete: "Löschen", Published: "Veröffentlicht", Draft: "Entwurf", "THE ORBIT LOUNGE": "DIE ORBIT-LOUNGE", "Global chat": "Globaler Chat", "One shared space for the whole crew and the ORBIT team.": "Ein gemeinsamer Raum für die gesamte Crew und das ORBIT-Team.", Live: "Live", "Checking for messages": "Nachrichten werden geprüft", Refresh: "Aktualisieren", "Refreshing…": "Wird aktualisiert…", "Clear chat": "Chat leeren", "Start the conversation.": "Starte das Gespräch.", "Say hello to your ORBIT community.": "Begrüße deine ORBIT-Community.", "Share something with the crew…": "Teile etwas mit der Crew…", "Send message": "Nachricht senden", "YOUR ORBIT CREW": "DEINE ORBIT-CREW", "Meet the crew, see who’s around, and start a private conversation.": "Lerne die Crew kennen, sieh, wer da ist, und beginne ein privates Gespräch.", "Show my online status": "Online-Status anzeigen", "Only active ORBIT members can see it.": "Nur aktive ORBIT-Mitglieder können ihn sehen.", "Member directory": "Mitgliederverzeichnis", "Member lists": "Mitgliederlisten", "Search members": "Mitglieder suchen", "Loading your ORBIT crew…": "Deine ORBIT-Crew wird geladen…", "No conversations yet. Choose someone in the crew to say hello.": "Noch keine Gespräche. Wähle jemanden aus der Crew aus und sag Hallo.", "You haven’t blocked anyone.": "Du hast niemanden blockiert.", "Status hidden": "Status verborgen", Online: "Online", Offline: "Offline", Unblock: "Blockierung aufheben", Open: "Öffnen", "Say hello": "Hallo sagen", "Member interaction failed.": "Mitgliederaktion fehlgeschlagen.", Dismiss: "Schließen", "Choose a new password.": "Wähle ein neues Passwort.", "Create a new password for your ORBIT account.": "Erstelle ein neues Passwort für dein ORBIT-Konto.", "New password": "Neues Passwort", "Confirm new password": "Neues Passwort bestätigen", "Update password": "Passwort aktualisieren", "Return to sign in": "Zurück zur Anmeldung",
  },
  "zh-CN": {
    "By continuing, you agree to use this community respectfully and keep members’ information private.": "继续即表示你同意尊重社区，并保护成员的隐私信息。",
    "GOOD THINGS HAPPEN TOGETHER": "携手共创美好",
    Language: "语言", "A COMMUNITY, IN MOTION": "一个不断前进的社区", "Better together.": "携手同行。", "One step at a time.": "一步一个脚印。", "Find your people, show up for each other, and make every mile mean a little more.": "找到志同道合的人，彼此支持，让每一段路程都更有意义。", "Made for the miles ahead.": "为前方的旅程而生。", "PLATFORM ADMINISTRATION": "平台管理", "WELCOME TO YOUR CREW": "欢迎加入团队", "Find your people.": "找到志同道合的人。", "Reset your password.": "重置密码。", "Admin sign in.": "管理员登录。", "Good to see you.": "很高兴再次见到你。", "Create your member account and join the ORBIT community.": "创建成员账号并加入 ORBIT 社区。", "We’ll email you a secure link to choose a new password.": "我们会通过电子邮件发送安全链接，供你设置新密码。", "Sign in with the administrator account provisioned by the platform owner.": "使用平台所有者创建的管理员账号登录。", "Sign in to pick up where your crew left off.": "登录并继续团队的下一段旅程。", "Back to sign in": "返回登录", "Account type": "账号类型", Member: "成员", Admin: "管理员", "Sign in": "登录", "Create account": "创建账号", "Full name": "姓名", "How should we call you?": "我们该如何称呼你？", Username: "用户名", "Email address": "电子邮箱", Password: "密码", "At least 8 characters": "至少 8 个字符", "Enter your password": "请输入密码", "Hide password": "隐藏密码", "Show password": "显示密码", "Resend confirmation email": "重新发送确认邮件", "Sending…": "正在发送…", "Connect Supabase to continue": "连接 Supabase 以继续", "One moment...": "请稍候…", "Create member account": "创建成员账号", "Send reset link": "发送重置链接", "Sign in as admin": "以管理员身份登录", "Forgot your password?": "忘记密码？", "New around here?": "刚来这里？", "Create a member account": "创建成员账号", "Good morning": "早上好", "Good afternoon": "下午好", "Good evening": "晚上好", Welcome: "欢迎", Overview: "概览", Calendar: "日历", Events: "活动", Quests: "任务", "Quest Review": "任务审核", "My Progress": "我的进度", Members: "成员", Membership: "会员资格", Profile: "个人资料", Chat: "聊天", Updates: "公告", Reports: "举报", More: "更多", Back: "返回", "Admin workspace": "管理工作区", "Your community": "你的社区", "Platform administrator": "平台管理员", "Crew member": "团队成员", "Sign out": "退出登录", "Could not load your workspace.": "无法加载工作区。", "Try again": "重试", "FROM THE ORBIT TEAM": "来自 ORBIT 团队", "ORBIT COMMUNITY": "ORBIT 社区", "Community updates": "社区公告", "Crew updates": "团队公告", "Share important updates where the whole crew can find them.": "在团队成员都能找到的地方分享重要信息。", "Official announcements and important news from your ORBIT team.": "ORBIT 团队的官方公告和重要消息。", "New update": "新公告", "Update failed.": "公告操作失败。", "NEW COMMUNITY UPDATE": "发布社区公告", "EDIT COMMUNITY UPDATE": "编辑社区公告", "Write an update": "撰写公告", "Edit update": "编辑公告", Title: "标题", Message: "内容", "Publish now": "立即发布", "Pin to top": "置顶", Cancel: "取消", "Saving…": "正在保存…", "Save changes": "保存更改", "Publish update": "发布公告", "Save draft": "保存草稿", "PUBLISHED & DRAFTS": "已发布和草稿", "LATEST NEWS": "最新消息", "All updates": "所有公告", "The ORBIT bulletin": "ORBIT 公告栏", "Loading updates…": "正在加载公告…", "No updates yet": "暂无公告", "All quiet for now": "目前暂无消息", "Post an update to give the crew one reliable place for important news.": "发布公告，为团队提供一个可靠的重要信息渠道。", "Official ORBIT announcements will show up here.": "ORBIT 官方公告将在此显示。", PINNED: "已置顶", DRAFT: "草稿", Edit: "编辑", Pin: "置顶", Unpin: "取消置顶", Publish: "发布", Unpublish: "撤下", Delete: "删除", Published: "已发布", Draft: "草稿", "THE ORBIT LOUNGE": "ORBIT 交流区", "Global chat": "全局聊天", "One shared space for the whole crew and the ORBIT team.": "整个团队和 ORBIT 成员共享的交流空间。", Live: "实时", "Checking for messages": "正在检查消息", Refresh: "刷新", "Refreshing…": "正在刷新…", "Clear chat": "清空聊天", "Start the conversation.": "开始对话。", "Say hello to your ORBIT community.": "向 ORBIT 社区问好。", "Share something with the crew…": "与团队分享一些内容…", "Send message": "发送消息", "YOUR ORBIT CREW": "你的 ORBIT 团队", "Meet the crew, see who’s around, and start a private conversation.": "认识团队成员，查看在线状态并开始私聊。", "Show my online status": "显示我的在线状态", "Only active ORBIT members can see it.": "只有 ORBIT 活跃成员可以查看。", "Member directory": "成员目录", "Member lists": "成员列表", "Search members": "搜索成员", "Loading your ORBIT crew…": "正在加载 ORBIT 团队…", "No conversations yet. Choose someone in the crew to say hello.": "暂无会话。选择一位团队成员打个招呼吧。", "You haven’t blocked anyone.": "你尚未屏蔽任何人。", "Status hidden": "状态隐藏", Online: "在线", Offline: "离线", Unblock: "取消屏蔽", Open: "打开", "Say hello": "打招呼", "Member interaction failed.": "成员互动操作失败。", Dismiss: "关闭", "Choose a new password.": "设置新密码。", "Create a new password for your ORBIT account.": "为 ORBIT 账号创建新密码。", "New password": "新密码", "Confirm new password": "确认新密码", "Update password": "更新密码", "Return to sign in": "返回登录",
  },
  ja: {
    "By continuing, you agree to use this community respectfully and keep members’ information private.": "続行すると、コミュニティを尊重し、メンバーの情報を守ることに同意したものとみなされます。",
    "GOOD THINGS HAPPEN TOGETHER": "一緒なら、素敵なことが起こる",
    Language: "言語", "A COMMUNITY, IN MOTION": "動き続けるコミュニティ", "Better together.": "一緒なら、もっといい。", "One step at a time.": "一歩ずつ。", "Find your people, show up for each other, and make every mile mean a little more.": "仲間を見つけ、支え合い、一歩一歩を大切なものにしよう。", "Made for the miles ahead.": "これからの道のりのために。", "PLATFORM ADMINISTRATION": "プラットフォーム管理", "WELCOME TO YOUR CREW": "クルーへようこそ", "Find your people.": "仲間を見つけよう。", "Reset your password.": "パスワードをリセット。", "Admin sign in.": "管理者ログイン。", "Good to see you.": "おかえりなさい。", "Create your member account and join the ORBIT community.": "メンバーアカウントを作成してORBITコミュニティに参加しましょう。", "We’ll email you a secure link to choose a new password.": "新しいパスワードを設定するための安全なリンクをメールでお送りします。", "Sign in with the administrator account provisioned by the platform owner.": "プラットフォーム所有者が作成した管理者アカウントでログインしてください。", "Sign in to pick up where your crew left off.": "ログインして、クルーの続きから始めましょう。", "Back to sign in": "ログインに戻る", "Account type": "アカウント種別", Member: "メンバー", Admin: "管理者", "Sign in": "ログイン", "Create account": "アカウント作成", "Full name": "氏名", "How should we call you?": "お名前を教えてください", Username: "ユーザー名", "Email address": "メールアドレス", Password: "パスワード", "At least 8 characters": "8文字以上", "Enter your password": "パスワードを入力", "Hide password": "パスワードを隠す", "Show password": "パスワードを表示", "Resend confirmation email": "確認メールを再送", "Sending…": "送信中…", "Connect Supabase to continue": "続けるにはSupabaseを接続してください", "One moment...": "少々お待ちください...", "Create member account": "メンバーアカウントを作成", "Send reset link": "リセットリンクを送信", "Sign in as admin": "管理者としてログイン", "Forgot your password?": "パスワードをお忘れですか？", "New around here?": "初めてですか？", "Create a member account": "メンバーアカウントを作成", "Good morning": "おはようございます", "Good afternoon": "こんにちは", "Good evening": "こんばんは", Welcome: "ようこそ", Overview: "概要", Calendar: "カレンダー", Events: "イベント", Quests: "クエスト", "Quest Review": "クエスト審査", "My Progress": "進捗", Members: "メンバー", Membership: "メンバーシップ", Profile: "プロフィール", Chat: "チャット", Updates: "お知らせ", Reports: "報告", More: "その他", Back: "戻る", "Admin workspace": "管理者ワークスペース", "Your community": "あなたのコミュニティ", "Platform administrator": "プラットフォーム管理者", "Crew member": "クルーメンバー", "Sign out": "ログアウト", "Could not load your workspace.": "ワークスペースを読み込めませんでした。", "Try again": "再試行", "FROM THE ORBIT TEAM": "ORBITチームから", "ORBIT COMMUNITY": "ORBITコミュニティ", "Community updates": "コミュニティのお知らせ", "Crew updates": "クルーのお知らせ", "Share important updates where the whole crew can find them.": "クルー全員が確認できる場所に大切なお知らせを投稿できます。", "Official announcements and important news from your ORBIT team.": "ORBITチームからの公式発表と重要なお知らせです。", "New update": "新しいお知らせ", "Update failed.": "お知らせを処理できませんでした。", "NEW COMMUNITY UPDATE": "新しいお知らせ", "EDIT COMMUNITY UPDATE": "お知らせを編集", "Write an update": "お知らせを書く", "Edit update": "お知らせを編集", Title: "タイトル", Message: "本文", "Publish now": "今すぐ公開", "Pin to top": "上部に固定", Cancel: "キャンセル", "Saving…": "保存中…", "Save changes": "変更を保存", "Publish update": "お知らせを公開", "Save draft": "下書きを保存", "PUBLISHED & DRAFTS": "公開済み・下書き", "LATEST NEWS": "最新情報", "All updates": "すべてのお知らせ", "The ORBIT bulletin": "ORBIT掲示板", "Loading updates…": "お知らせを読み込み中…", "No updates yet": "お知らせはまだありません", "All quiet for now": "現在、新しいお知らせはありません", "Post an update to give the crew one reliable place for important news.": "大切な情報をクルーがいつでも確認できる場所に投稿しましょう。", "Official ORBIT announcements will show up here.": "ORBIT公式のお知らせがここに表示されます。", PINNED: "固定", DRAFT: "下書き", Edit: "編集", Pin: "固定", Unpin: "固定解除", Publish: "公開", Unpublish: "非公開", Delete: "削除", Published: "公開済み", Draft: "下書き", "THE ORBIT LOUNGE": "ORBITラウンジ", "Global chat": "全体チャット", "One shared space for the whole crew and the ORBIT team.": "クルー全員とORBITチームが共有するスペースです。", Live: "接続中", "Checking for messages": "メッセージを確認中", Refresh: "更新", "Refreshing…": "更新中…", "Clear chat": "チャットを消去", "Start the conversation.": "会話を始めましょう。", "Say hello to your ORBIT community.": "ORBITコミュニティに挨拶しましょう。", "Share something with the crew…": "クルーにメッセージを送る…", "Send message": "メッセージを送信", "YOUR ORBIT CREW": "あなたのORBITクルー", "Meet the crew, see who’s around, and start a private conversation.": "クルーと出会い、オンライン状況を確認して、個別に会話できます。", "Show my online status": "オンライン状態を表示", "Only active ORBIT members can see it.": "ORBITのアクティブメンバーのみが確認できます。", "Member directory": "メンバー一覧", "Member lists": "メンバーリスト", "Search members": "メンバーを検索", "Loading your ORBIT crew…": "ORBITクルーを読み込み中…", "No conversations yet. Choose someone in the crew to say hello.": "会話はまだありません。クルーのメンバーに挨拶しましょう。", "You haven’t blocked anyone.": "ブロック中のメンバーはいません。", "Status hidden": "非表示", Online: "オンライン", Offline: "オフライン", Unblock: "ブロック解除", Open: "開く", "Say hello": "挨拶する", "Member interaction failed.": "メンバーとの操作に失敗しました。", Dismiss: "閉じる", "Choose a new password.": "新しいパスワードを設定。", "Create a new password for your ORBIT account.": "ORBITアカウントの新しいパスワードを作成します。", "New password": "新しいパスワード", "Confirm new password": "新しいパスワードを確認", "Update password": "パスワードを更新", "Return to sign in": "ログインに戻る",
  },
  ko: {
    "By continuing, you agree to use this community respectfully and keep members’ information private.": "계속 진행하면 커뮤니티를 존중하고 멤버의 정보를 안전하게 보호하는 데 동의하는 것입니다.",
    "GOOD THINGS HAPPEN TOGETHER": "함께라면 좋은 일이 생겨요",
    Language: "언어", "A COMMUNITY, IN MOTION": "함께 움직이는 커뮤니티", "Better together.": "함께라서 더 좋아요.", "One step at a time.": "한 걸음씩.", "Find your people, show up for each other, and make every mile mean a little more.": "마음 맞는 사람을 만나 서로 힘이 되어 주고, 모든 여정을 더 의미 있게 만들어 보세요.", "Made for the miles ahead.": "앞으로의 여정을 위해.", "PLATFORM ADMINISTRATION": "플랫폼 관리", "WELCOME TO YOUR CREW": "크루에 오신 것을 환영합니다", "Find your people.": "마음 맞는 사람을 만나 보세요.", "Reset your password.": "비밀번호를 재설정하세요.", "Admin sign in.": "관리자 로그인.", "Good to see you.": "다시 만나 반가워요.", "Create your member account and join the ORBIT community.": "멤버 계정을 만들고 ORBIT 커뮤니티에 참여하세요.", "We’ll email you a secure link to choose a new password.": "새 비밀번호를 설정할 수 있는 안전한 링크를 이메일로 보내 드립니다.", "Sign in with the administrator account provisioned by the platform owner.": "플랫폼 소유자가 만든 관리자 계정으로 로그인하세요.", "Sign in to pick up where your crew left off.": "로그인하고 크루의 여정을 이어가세요.", "Back to sign in": "로그인으로 돌아가기", "Account type": "계정 유형", Member: "멤버", Admin: "관리자", "Sign in": "로그인", "Create account": "계정 만들기", "Full name": "이름", "How should we call you?": "어떻게 불러 드릴까요?", Username: "사용자 이름", "Email address": "이메일 주소", Password: "비밀번호", "At least 8 characters": "8자 이상", "Enter your password": "비밀번호를 입력하세요", "Hide password": "비밀번호 숨기기", "Show password": "비밀번호 표시", "Resend confirmation email": "확인 이메일 다시 보내기", "Sending…": "보내는 중…", "Connect Supabase to continue": "계속하려면 Supabase를 연결하세요", "One moment...": "잠시만 기다려 주세요...", "Create member account": "멤버 계정 만들기", "Send reset link": "재설정 링크 보내기", "Sign in as admin": "관리자로 로그인", "Forgot your password?": "비밀번호를 잊으셨나요?", "New around here?": "처음 방문하셨나요?", "Create a member account": "멤버 계정 만들기", "Good morning": "좋은 아침이에요", "Good afternoon": "안녕하세요", "Good evening": "좋은 저녁이에요", Welcome: "환영합니다", Overview: "개요", Calendar: "캘린더", Events: "이벤트", Quests: "퀘스트", "Quest Review": "퀘스트 검토", "My Progress": "내 진행 상황", Members: "멤버", Membership: "멤버십", Profile: "프로필", Chat: "채팅", Updates: "공지사항", Reports: "신고", More: "더 보기", Back: "뒤로", "Admin workspace": "관리자 작업 공간", "Your community": "내 커뮤니티", "Platform administrator": "플랫폼 관리자", "Crew member": "크루 멤버", "Sign out": "로그아웃", "Could not load your workspace.": "작업 공간을 불러오지 못했습니다.", "Try again": "다시 시도", "FROM THE ORBIT TEAM": "ORBIT 팀 공지", "ORBIT COMMUNITY": "ORBIT 커뮤니티", "Community updates": "커뮤니티 공지", "Crew updates": "크루 소식", "Share important updates where the whole crew can find them.": "모든 크루원이 확인할 수 있는 곳에 중요한 소식을 공유하세요.", "Official announcements and important news from your ORBIT team.": "ORBIT 팀의 공식 공지와 중요한 소식입니다.", "New update": "새 공지", "Update failed.": "공지 처리에 실패했습니다.", "NEW COMMUNITY UPDATE": "새 커뮤니티 공지", "EDIT COMMUNITY UPDATE": "커뮤니티 공지 수정", "Write an update": "공지 작성", "Edit update": "공지 수정", Title: "제목", Message: "내용", "Publish now": "지금 게시", "Pin to top": "상단에 고정", Cancel: "취소", "Saving…": "저장 중…", "Save changes": "변경 사항 저장", "Publish update": "공지 게시", "Save draft": "초안 저장", "PUBLISHED & DRAFTS": "게시됨 및 초안", "LATEST NEWS": "최신 소식", "All updates": "모든 공지", "The ORBIT bulletin": "ORBIT 소식 게시판", "Loading updates…": "공지를 불러오는 중…", "No updates yet": "아직 공지가 없습니다", "All quiet for now": "현재 새로운 소식이 없습니다", "Post an update to give the crew one reliable place for important news.": "중요한 소식을 크루가 한곳에서 확인할 수 있도록 공지를 게시하세요.", "Official ORBIT announcements will show up here.": "ORBIT 공식 공지가 여기에 표시됩니다.", PINNED: "고정됨", DRAFT: "초안", Edit: "수정", Pin: "고정", Unpin: "고정 해제", Publish: "게시", Unpublish: "게시 취소", Delete: "삭제", Published: "게시됨", Draft: "초안", "THE ORBIT LOUNGE": "ORBIT 라운지", "Global chat": "전체 채팅", "One shared space for the whole crew and the ORBIT team.": "전체 크루와 ORBIT 팀이 함께 사용하는 공간입니다.", Live: "실시간", "Checking for messages": "메시지 확인 중", Refresh: "새로고침", "Refreshing…": "새로고침 중…", "Clear chat": "채팅 비우기", "Start the conversation.": "대화를 시작해 보세요.", "Say hello to your ORBIT community.": "ORBIT 커뮤니티에 인사를 건네 보세요.", "Share something with the crew…": "크루와 이야기를 나눠 보세요…", "Send message": "메시지 보내기", "YOUR ORBIT CREW": "나의 ORBIT 크루", "Meet the crew, see who’s around, and start a private conversation.": "크루를 만나고 온라인 상태를 확인한 뒤 비공개 대화를 시작하세요.", "Show my online status": "온라인 상태 표시", "Only active ORBIT members can see it.": "활성 ORBIT 멤버만 볼 수 있습니다.", "Member directory": "멤버 디렉터리", "Member lists": "멤버 목록", "Search members": "멤버 검색", "Loading your ORBIT crew…": "ORBIT 크루를 불러오는 중…", "No conversations yet. Choose someone in the crew to say hello.": "아직 대화가 없습니다. 크루에서 대화할 사람을 선택해 보세요.", "You haven’t blocked anyone.": "차단한 사람이 없습니다.", "Status hidden": "상태 숨김", Online: "온라인", Offline: "오프라인", Unblock: "차단 해제", Open: "열기", "Say hello": "인사하기", "Member interaction failed.": "멤버 작업에 실패했습니다.", Dismiss: "닫기", "Choose a new password.": "새 비밀번호를 설정하세요.", "Create a new password for your ORBIT account.": "ORBIT 계정의 새 비밀번호를 만드세요.", "New password": "새 비밀번호", "Confirm new password": "새 비밀번호 확인", "Update password": "비밀번호 업데이트", "Return to sign in": "로그인으로 돌아가기",
  },
  ar: {
    "By continuing, you agree to use this community respectfully and keep members’ information private.": "بالمتابعة، فإنك توافق على احترام هذا المجتمع والحفاظ على خصوصية معلومات أعضائه.",
    "GOOD THINGS HAPPEN TOGETHER": "معًا نصنع أشياء جميلة",
    Language: "اللغة", "A COMMUNITY, IN MOTION": "مجتمع دائم الحركة", "Better together.": "معًا أفضل.", "One step at a time.": "خطوة بخطوة.", "Find your people, show up for each other, and make every mile mean a little more.": "اعثر على رفاقك، وساندوا بعضكم، واجعلوا لكل خطوة معنى أكبر.", "Made for the miles ahead.": "للطريق الذي ينتظرنا.", "PLATFORM ADMINISTRATION": "إدارة المنصة", "WELCOME TO YOUR CREW": "مرحبًا بك في فريقك", "Find your people.": "اعثر على رفاقك.", "Reset your password.": "إعادة تعيين كلمة المرور.", "Admin sign in.": "تسجيل دخول المسؤول.", "Good to see you.": "سعيدون بعودتك.", "Create your member account and join the ORBIT community.": "أنشئ حساب عضو وانضم إلى مجتمع ORBIT.", "We’ll email you a secure link to choose a new password.": "سنرسل إليك رابطًا آمنًا لاختيار كلمة مرور جديدة.", "Sign in with the administrator account provisioned by the platform owner.": "سجّل الدخول بحساب المسؤول الذي أنشأه مالك المنصة.", "Sign in to pick up where your crew left off.": "سجّل الدخول لمتابعة ما بدأه فريقك.", "Back to sign in": "العودة إلى تسجيل الدخول", "Account type": "نوع الحساب", Member: "عضو", Admin: "مسؤول", "Sign in": "تسجيل الدخول", "Create account": "إنشاء حساب", "Full name": "الاسم الكامل", "How should we call you?": "ما الاسم الذي تفضّل أن نناديك به؟", Username: "اسم المستخدم", "Email address": "البريد الإلكتروني", Password: "كلمة المرور", "At least 8 characters": "8 أحرف على الأقل", "Enter your password": "أدخل كلمة المرور", "Hide password": "إخفاء كلمة المرور", "Show password": "إظهار كلمة المرور", "Resend confirmation email": "إعادة إرسال رسالة التأكيد", "Sending…": "جارٍ الإرسال…", "Connect Supabase to continue": "اربط Supabase للمتابعة", "One moment...": "لحظة واحدة...", "Create member account": "إنشاء حساب عضو", "Send reset link": "إرسال رابط إعادة التعيين", "Sign in as admin": "تسجيل الدخول كمسؤول", "Forgot your password?": "هل نسيت كلمة المرور؟", "New around here?": "هل أنت جديد هنا؟", "Create a member account": "إنشاء حساب عضو", "Good morning": "صباح الخير", "Good afternoon": "مساء الخير", "Good evening": "مساء الخير", Welcome: "مرحبًا", Overview: "نظرة عامة", Calendar: "التقويم", Events: "الفعاليات", Quests: "المهام", "Quest Review": "مراجعة المهام", "My Progress": "تقدمي", Members: "الأعضاء", Membership: "العضوية", Profile: "الملف الشخصي", Chat: "المحادثة", Updates: "الإعلانات", Reports: "البلاغات", More: "المزيد", Back: "رجوع", "Admin workspace": "مساحة المسؤول", "Your community": "مجتمعك", "Platform administrator": "مسؤول المنصة", "Crew member": "عضو الفريق", "Sign out": "تسجيل الخروج", "Could not load your workspace.": "تعذّر تحميل مساحة العمل.", "Try again": "حاول مرة أخرى", "FROM THE ORBIT TEAM": "من فريق ORBIT", "ORBIT COMMUNITY": "مجتمع ORBIT", "Community updates": "إعلانات المجتمع", "Crew updates": "أخبار الفريق", "Share important updates where the whole crew can find them.": "شارك الأخبار المهمة في مكان يسهل على الفريق كله الوصول إليه.", "Official announcements and important news from your ORBIT team.": "الإعلانات الرسمية والأخبار المهمة من فريق ORBIT.", "New update": "إعلان جديد", "Update failed.": "تعذّر حفظ الإعلان.", "NEW COMMUNITY UPDATE": "إعلان مجتمعي جديد", "EDIT COMMUNITY UPDATE": "تعديل إعلان المجتمع", "Write an update": "اكتب إعلانًا", "Edit update": "تعديل الإعلان", Title: "العنوان", Message: "الرسالة", "Publish now": "نشر الآن", "Pin to top": "تثبيت في الأعلى", Cancel: "إلغاء", "Saving…": "جارٍ الحفظ…", "Save changes": "حفظ التغييرات", "Publish update": "نشر الإعلان", "Save draft": "حفظ المسودة", "PUBLISHED & DRAFTS": "المنشور والمسودات", "LATEST NEWS": "آخر الأخبار", "All updates": "كل الإعلانات", "The ORBIT bulletin": "لوحة أخبار ORBIT", "Loading updates…": "جارٍ تحميل الإعلانات…", "No updates yet": "لا توجد إعلانات بعد", "All quiet for now": "لا توجد أخبار جديدة الآن", "Post an update to give the crew one reliable place for important news.": "انشر إعلانًا ليجد الفريق الأخبار المهمة في مكان موثوق واحد.", "Official ORBIT announcements will show up here.": "ستظهر إعلانات ORBIT الرسمية هنا.", PINNED: "مثبّت", DRAFT: "مسودة", Edit: "تعديل", Pin: "تثبيت", Unpin: "إلغاء التثبيت", Publish: "نشر", Unpublish: "إلغاء النشر", Delete: "حذف", Published: "منشور", Draft: "مسودة", "THE ORBIT LOUNGE": "استراحة ORBIT", "Global chat": "المحادثة العامة", "One shared space for the whole crew and the ORBIT team.": "مساحة مشتركة للفريق بأكمله ولفريق ORBIT.", Live: "مباشر", "Checking for messages": "جارٍ التحقق من الرسائل", Refresh: "تحديث", "Refreshing…": "جارٍ التحديث…", "Clear chat": "مسح المحادثة", "Start the conversation.": "ابدأ المحادثة.", "Say hello to your ORBIT community.": "حيِّ مجتمع ORBIT.", "Share something with the crew…": "شارك شيئًا مع الفريق…", "Send message": "إرسال الرسالة", "YOUR ORBIT CREW": "فريق ORBIT الخاص بك", "Meet the crew, see who’s around, and start a private conversation.": "تعرّف على الفريق، وشاهد المتصلين، وابدأ محادثة خاصة.", "Show my online status": "إظهار حالة الاتصال", "Only active ORBIT members can see it.": "يمكن لأعضاء ORBIT النشطين فقط رؤيتها.", "Member directory": "دليل الأعضاء", "Member lists": "قوائم الأعضاء", "Search members": "ابحث عن أعضاء", "Loading your ORBIT crew…": "جارٍ تحميل فريق ORBIT…", "No conversations yet. Choose someone in the crew to say hello.": "لا توجد محادثات بعد. اختر شخصًا من الفريق لإلقاء التحية.", "You haven’t blocked anyone.": "لم تحظر أي شخص.", "Status hidden": "الحالة مخفية", Online: "متصل", Offline: "غير متصل", Unblock: "إلغاء الحظر", Open: "فتح", "Say hello": "إلقاء التحية", "Member interaction failed.": "تعذّر التفاعل مع العضو.", Dismiss: "إغلاق", "Choose a new password.": "اختر كلمة مرور جديدة.", "Create a new password for your ORBIT account.": "أنشئ كلمة مرور جديدة لحساب ORBIT.", "New password": "كلمة المرور الجديدة", "Confirm new password": "تأكيد كلمة المرور الجديدة", "Update password": "تحديث كلمة المرور", "Return to sign in": "العودة إلى تسجيل الدخول",
  },
};

const additionalTranslations: Partial<Record<Locale, TranslationPack>> = {
  id: {
    "Welcome to ORBIT,": "Selamat datang di ORBIT,",
    "Here are a few good places to start. You can always find them in the menu.": "Berikut beberapa tempat yang bisa kamu kunjungi untuk memulai. Semuanya bisa ditemukan di menu.",
    "Got it, let’s go": "Mengerti, ayo mulai",
    Close: "Tutup",
    "Set a goal and reward for your crew.": "Tentukan tujuan dan hadiah untuk kru.",
    "Bring members together with an event.": "Kumpulkan anggota lewat sebuah acara.",
    "Share important news with every member.": "Bagikan kabar penting kepada semua anggota.",
    "See what your ORBIT crew is planning.": "Lihat rencana kru ORBIT-mu.",
    "Find members and start a conversation.": "Temukan anggota dan mulai percakapan.",
    "Check official news from your ORBIT team.": "Lihat kabar resmi dari tim ORBIT.",
    "Find an event": "Cari acara", "Meet your crew": "Kenali kru", "Read crew updates": "Baca kabar kru", "Post an update": "Buat pengumuman",
    "Updates will appear here when an admin publishes one.": "Pengumuman akan muncul di sini setelah admin menerbitkannya.",
    "Create first update": "Buat pengumuman pertama", "Explore events": "Jelajahi acara", "Open crew chat": "Buka obrolan kru",
    Messages: "Pesan", Blocked: "Diblokir",
    "Create events and control their details, visibility, and status.": "Buat acara dan atur detail, visibilitas, serta statusnya.",
    "Create event": "Buat acara", "Create an event": "Buat acara", "Edit event": "Edit acara", "NEW ORBIT EVENT": "ACARA ORBIT BARU", "UPDATE ORBIT EVENT": "PERBARUI ACARA ORBIT",
    "Event action failed.": "Tindakan acara gagal.", "Event name": "Nama acara", "Date and time": "Tanggal dan waktu", Location: "Lokasi", "Capacity (optional)": "Kapasitas (opsional)", Visibility: "Visibilitas", "Public to members": "Terbuka untuk anggota", Private: "Pribadi", Status: "Status", Description: "Deskripsi",
    "Quests & missions": "Misi & tantangan", "Set goals and XP rewards, and control the quest deadline.": "Atur target, hadiah XP, dan tenggat misi.", "Create quest": "Buat misi", "Create a quest": "Buat misi", "Edit quest": "Edit misi", "NEW ORBIT QUEST": "MISI ORBIT BARU", "UPDATE ORBIT QUEST": "PERBARUI MISI ORBIT", "Quest action failed.": "Tindakan misi gagal.", "Quest name": "Nama misi", "Deadline (optional)": "Tenggat (opsional)", "XP reward": "Hadiah XP", Goal: "Target", "Give the crew a challenge.": "Berikan tantangan untuk kru.", "Create a quest with a goal and XP reward to get started.": "Buat misi dengan target dan hadiah XP untuk memulai.",
  },
  es: {
    "Welcome to ORBIT,": "Te damos la bienvenida a ORBIT,",
    "Here are a few good places to start. You can always find them in the menu.": "Aquí tienes algunos buenos lugares para empezar. Siempre puedes encontrarlos en el menú.",
    "Got it, let’s go": "Entendido, vamos",
    Close: "Cerrar",
    "Set a goal and reward for your crew.": "Define un objetivo y una recompensa para el equipo.",
    "Bring members together with an event.": "Reúne a los miembros con un evento.",
    "Share important news with every member.": "Comparte noticias importantes con todos los miembros.",
    "See what your ORBIT crew is planning.": "Descubre qué está organizando tu equipo ORBIT.",
    "Find members and start a conversation.": "Encuentra miembros e inicia una conversación.",
    "Check official news from your ORBIT team.": "Consulta las noticias oficiales de tu equipo ORBIT.",
    "Find an event": "Buscar un evento", "Meet your crew": "Conoce al equipo", "Read crew updates": "Leer novedades", "Post an update": "Publicar una novedad",
    "Updates will appear here when an admin publishes one.": "Las novedades aparecerán aquí cuando un administrador publique una.",
    "Create first update": "Crear la primera novedad", "Explore events": "Explorar eventos", "Open crew chat": "Abrir chat del equipo",
    Messages: "Mensajes", Blocked: "Bloqueados",
    "Create events and control their details, visibility, and status.": "Crea eventos y gestiona sus detalles, visibilidad y estado.",
    "Create event": "Crear evento", "Create an event": "Crear un evento", "Edit event": "Editar evento", "NEW ORBIT EVENT": "NUEVO EVENTO ORBIT", "UPDATE ORBIT EVENT": "ACTUALIZAR EVENTO ORBIT",
    "Event action failed.": "No se pudo completar la acción del evento.", "Event name": "Nombre del evento", "Date and time": "Fecha y hora", Location: "Ubicación", "Capacity (optional)": "Aforo (opcional)", Visibility: "Visibilidad", "Public to members": "Visible para miembros", Private: "Privado", Status: "Estado", Description: "Descripción",
    "Quests & missions": "Misiones y desafíos", "Set goals and XP rewards, and control the quest deadline.": "Define objetivos y recompensas de XP, y controla la fecha límite.", "Create quest": "Crear misión", "Create a quest": "Crear una misión", "Edit quest": "Editar misión", "NEW ORBIT QUEST": "NUEVA MISIÓN ORBIT", "UPDATE ORBIT QUEST": "ACTUALIZAR MISIÓN ORBIT", "Quest action failed.": "No se pudo completar la acción de la misión.", "Quest name": "Nombre de la misión", "Deadline (optional)": "Fecha límite (opcional)", "XP reward": "Recompensa de XP", Goal: "Objetivo", "Give the crew a challenge.": "Propón un desafío al equipo.", "Create a quest with a goal and XP reward to get started.": "Crea una misión con un objetivo y una recompensa de XP para empezar.",
  },
  "pt-BR": {
    "Welcome to ORBIT,": "Boas-vindas à ORBIT,",
    "Here are a few good places to start. You can always find them in the menu.": "Aqui estão alguns bons lugares para começar. Você sempre pode encontrá-los no menu.",
    "Got it, let’s go": "Entendi, vamos lá",
    Close: "Fechar",
    "Set a goal and reward for your crew.": "Defina uma meta e uma recompensa para sua equipe.",
    "Bring members together with an event.": "Reúna os membros em um evento.",
    "Share important news with every member.": "Compartilhe notícias importantes com todos os membros.",
    "See what your ORBIT crew is planning.": "Veja o que sua equipe ORBIT está planejando.",
    "Find members and start a conversation.": "Encontre membros e comece uma conversa.",
    "Check official news from your ORBIT team.": "Confira as notícias oficiais da equipe ORBIT.",
    "Find an event": "Encontrar um evento", "Meet your crew": "Conhecer a equipe", "Read crew updates": "Ler novidades", "Post an update": "Publicar novidade",
    "Updates will appear here when an admin publishes one.": "As novidades aparecerão aqui quando um administrador publicar uma.",
    "Create first update": "Criar a primeira novidade", "Explore events": "Explorar eventos", "Open crew chat": "Abrir chat da equipe",
    Messages: "Mensagens", Blocked: "Bloqueados",
    "Create events and control their details, visibility, and status.": "Crie eventos e gerencie detalhes, visibilidade e status.",
    "Create event": "Criar evento", "Create an event": "Criar um evento", "Edit event": "Editar evento", "NEW ORBIT EVENT": "NOVO EVENTO ORBIT", "UPDATE ORBIT EVENT": "ATUALIZAR EVENTO ORBIT",
    "Event action failed.": "Falha ao processar o evento.", "Event name": "Nome do evento", "Date and time": "Data e horário", Location: "Local", "Capacity (optional)": "Capacidade (opcional)", Visibility: "Visibilidade", "Public to members": "Visível para membros", Private: "Privado", Status: "Status", Description: "Descrição",
    "Quests & missions": "Missões e desafios", "Set goals and XP rewards, and control the quest deadline.": "Defina metas e recompensas de XP e controle o prazo da missão.", "Create quest": "Criar missão", "Create a quest": "Criar uma missão", "Edit quest": "Editar missão", "NEW ORBIT QUEST": "NOVA MISSÃO ORBIT", "UPDATE ORBIT QUEST": "ATUALIZAR MISSÃO ORBIT", "Quest action failed.": "Falha ao processar a missão.", "Quest name": "Nome da missão", "Deadline (optional)": "Prazo (opcional)", "XP reward": "Recompensa de XP", Goal: "Meta", "Give the crew a challenge.": "Proponha um desafio para a turma.", "Create a quest with a goal and XP reward to get started.": "Crie uma missão com uma meta e recompensa de XP para começar.",
  },
  fr: {
    "Welcome to ORBIT,": "Bienvenue sur ORBIT,",
    "Here are a few good places to start. You can always find them in the menu.": "Voici quelques bons endroits pour commencer. Vous les retrouverez toujours dans le menu.",
    "Got it, let’s go": "Compris, c’est parti",
    Close: "Fermer",
    "Set a goal and reward for your crew.": "Définissez un objectif et une récompense pour votre équipe.",
    "Bring members together with an event.": "Réunissez les membres autour d’un événement.",
    "Share important news with every member.": "Partagez les informations importantes avec tous les membres.",
    "See what your ORBIT crew is planning.": "Découvrez ce que votre équipe ORBIT prépare.",
    "Find members and start a conversation.": "Trouvez des membres et démarrez une conversation.",
    "Check official news from your ORBIT team.": "Consultez les actualités officielles de votre équipe ORBIT.",
    "Find an event": "Trouver un événement", "Meet your crew": "Rencontrer l’équipe", "Read crew updates": "Lire les actualités", "Post an update": "Publier une actualité",
    "Updates will appear here when an admin publishes one.": "Les actualités apparaîtront ici lorsqu’un administrateur en publiera une.",
    "Create first update": "Créer la première actualité", "Explore events": "Découvrir les événements", "Open crew chat": "Ouvrir la discussion",
    Messages: "Messages", Blocked: "Bloqués",
    "Create events and control their details, visibility, and status.": "Créez des événements et gérez leurs détails, leur visibilité et leur statut.",
    "Create event": "Créer un événement", "Create an event": "Créer un événement", "Edit event": "Modifier l’événement", "NEW ORBIT EVENT": "NOUVEL ÉVÉNEMENT ORBIT", "UPDATE ORBIT EVENT": "MODIFIER L’ÉVÉNEMENT ORBIT",
    "Event action failed.": "Échec de l’action sur l’événement.", "Event name": "Nom de l’événement", "Date and time": "Date et heure", Location: "Lieu", "Capacity (optional)": "Capacité (facultatif)", Visibility: "Visibilité", "Public to members": "Visible par les membres", Private: "Privé", Status: "Statut", Description: "Description",
    "Quests & missions": "Défis et missions", "Set goals and XP rewards, and control the quest deadline.": "Définissez les objectifs et les récompenses XP, et gérez l’échéance du défi.", "Create quest": "Créer un défi", "Create a quest": "Créer un défi", "Edit quest": "Modifier le défi", "NEW ORBIT QUEST": "NOUVEAU DÉFI ORBIT", "UPDATE ORBIT QUEST": "MODIFIER LE DÉFI ORBIT", "Quest action failed.": "Échec de l’action sur le défi.", "Quest name": "Nom du défi", "Deadline (optional)": "Échéance (facultatif)", "XP reward": "Récompense XP", Goal: "Objectif", "Give the crew a challenge.": "Proposez un défi à l’équipe.", "Create a quest with a goal and XP reward to get started.": "Créez un défi avec un objectif et une récompense XP pour commencer.",
  },
  de: {
    "Welcome to ORBIT,": "Willkommen bei ORBIT,",
    "Here are a few good places to start. You can always find them in the menu.": "Hier sind einige gute Startpunkte. Du findest sie jederzeit im Menü.",
    "Got it, let’s go": "Alles klar, los geht’s",
    Close: "Schließen",
    "Set a goal and reward for your crew.": "Lege ein Ziel und eine Belohnung für dein Team fest.",
    "Bring members together with an event.": "Bringe Mitglieder bei einem Event zusammen.",
    "Share important news with every member.": "Teile wichtige Neuigkeiten mit allen Mitgliedern.",
    "See what your ORBIT crew is planning.": "Sieh dir an, was dein ORBIT-Team plant.",
    "Find members and start a conversation.": "Finde Mitglieder und beginne ein Gespräch.",
    "Check official news from your ORBIT team.": "Lies offizielle Neuigkeiten deines ORBIT-Teams.",
    "Find an event": "Event finden", "Meet your crew": "Team kennenlernen", "Read crew updates": "Neuigkeiten lesen", "Post an update": "Neuigkeit veröffentlichen",
    "Updates will appear here when an admin publishes one.": "Neuigkeiten erscheinen hier, sobald ein Admin sie veröffentlicht.",
    "Create first update": "Erste Neuigkeit erstellen", "Explore events": "Events entdecken", "Open crew chat": "Team-Chat öffnen",
    Messages: "Nachrichten", Blocked: "Blockiert",
    "Create events and control their details, visibility, and status.": "Erstelle Events und verwalte Details, Sichtbarkeit und Status.",
    "Create event": "Event erstellen", "Create an event": "Event erstellen", "Edit event": "Event bearbeiten", "NEW ORBIT EVENT": "NEUES ORBIT-EVENT", "UPDATE ORBIT EVENT": "ORBIT-EVENT AKTUALISIEREN",
    "Event action failed.": "Event-Aktion fehlgeschlagen.", "Event name": "Eventname", "Date and time": "Datum und Uhrzeit", Location: "Ort", "Capacity (optional)": "Kapazität (optional)", Visibility: "Sichtbarkeit", "Public to members": "Für Mitglieder sichtbar", Private: "Privat", Status: "Status", Description: "Beschreibung",
    "Quests & missions": "Aufgaben und Missionen", "Set goals and XP rewards, and control the quest deadline.": "Lege Ziele und XP-Belohnungen fest und verwalte die Frist.", "Create quest": "Aufgabe erstellen", "Create a quest": "Aufgabe erstellen", "Edit quest": "Aufgabe bearbeiten", "NEW ORBIT QUEST": "NEUE ORBIT-AUFGABE", "UPDATE ORBIT QUEST": "ORBIT-AUFGABE AKTUALISIEREN", "Quest action failed.": "Aufgabenaktion fehlgeschlagen.", "Quest name": "Aufgabenname", "Deadline (optional)": "Frist (optional)", "XP reward": "XP-Belohnung", Goal: "Ziel", "Give the crew a challenge.": "Stelle der Crew eine Herausforderung.", "Create a quest with a goal and XP reward to get started.": "Erstelle zum Start eine Aufgabe mit Ziel und XP-Belohnung.",
  },
  "zh-CN": {
    "Welcome to ORBIT,": "欢迎来到 ORBIT，",
    "Here are a few good places to start. You can always find them in the menu.": "这里有几个不错的起点，你也可以随时在菜单中找到它们。",
    "Got it, let’s go": "知道了，开始吧",
    Close: "关闭",
    "Set a goal and reward for your crew.": "为团队设定目标和奖励。",
    "Bring members together with an event.": "通过活动让成员相聚。",
    "Share important news with every member.": "向所有成员分享重要消息。",
    "See what your ORBIT crew is planning.": "查看 ORBIT 团队的活动安排。",
    "Find members and start a conversation.": "查找成员并开始交流。",
    "Check official news from your ORBIT team.": "查看 ORBIT 团队的官方消息。",
    "Find an event": "查找活动", "Meet your crew": "认识团队", "Read crew updates": "查看团队动态", "Post an update": "发布动态",
    "Updates will appear here when an admin publishes one.": "管理员发布动态后，这里就会显示。",
    "Create first update": "发布第一条动态", "Explore events": "浏览活动", "Open crew chat": "打开团队聊天",
    Messages: "消息", Blocked: "已屏蔽",
    "Create events and control their details, visibility, and status.": "创建活动并管理详情、可见范围和状态。",
    "Create event": "创建活动", "Create an event": "创建活动", "Edit event": "编辑活动", "NEW ORBIT EVENT": "新建 ORBIT 活动", "UPDATE ORBIT EVENT": "更新 ORBIT 活动",
    "Event action failed.": "活动操作失败。", "Event name": "活动名称", "Date and time": "日期和时间", Location: "地点", "Capacity (optional)": "人数上限（可选）", Visibility: "可见范围", "Public to members": "对成员公开", Private: "私密", Status: "状态", Description: "描述",
    "Quests & missions": "任务与挑战", "Set goals and XP rewards, and control the quest deadline.": "设置目标和 XP 奖励，并管理任务截止时间。", "Create quest": "创建任务", "Create a quest": "创建任务", "Edit quest": "编辑任务", "NEW ORBIT QUEST": "新建 ORBIT 任务", "UPDATE ORBIT QUEST": "更新 ORBIT 任务", "Quest action failed.": "任务操作失败。", "Quest name": "任务名称", "Deadline (optional)": "截止时间（可选）", "XP reward": "XP 奖励", Goal: "目标", "Give the crew a challenge.": "为团队设置一个挑战。", "Create a quest with a goal and XP reward to get started.": "创建包含目标和 XP 奖励的任务，开始使用。",
  },
  ja: {
    "Welcome to ORBIT,": "ORBITへようこそ、",
    "Here are a few good places to start. You can always find them in the menu.": "まずはこちらから始めてみましょう。いつでもメニューから確認できます。",
    "Got it, let’s go": "了解、始めましょう",
    Close: "閉じる",
    "Set a goal and reward for your crew.": "クルーの目標と報酬を設定しましょう。",
    "Bring members together with an event.": "イベントでメンバーをつなげましょう。",
    "Share important news with every member.": "大切なお知らせをすべてのメンバーに共有しましょう。",
    "See what your ORBIT crew is planning.": "ORBITクルーの予定を確認しましょう。",
    "Find members and start a conversation.": "メンバーを探して会話を始めましょう。",
    "Check official news from your ORBIT team.": "ORBITチームの公式ニュースを確認しましょう。",
    "Find an event": "イベントを探す", "Meet your crew": "クルーに会う", "Read crew updates": "クルーのお知らせ", "Post an update": "お知らせを投稿",
    "Updates will appear here when an admin publishes one.": "管理者がお知らせを公開すると、ここに表示されます。",
    "Create first update": "最初のお知らせを作成", "Explore events": "イベントを見る", "Open crew chat": "クルーチャットを開く",
    Messages: "メッセージ", Blocked: "ブロック中",
    "Create events and control their details, visibility, and status.": "イベントを作成し、詳細・公開範囲・ステータスを管理します。",
    "Create event": "イベントを作成", "Create an event": "イベントを作成", "Edit event": "イベントを編集", "NEW ORBIT EVENT": "新しいORBITイベント", "UPDATE ORBIT EVENT": "ORBITイベントを更新",
    "Event action failed.": "イベントの操作に失敗しました。", "Event name": "イベント名", "Date and time": "日時", Location: "場所", "Capacity (optional)": "定員（任意）", Visibility: "公開範囲", "Public to members": "メンバーに公開", Private: "非公開", Status: "ステータス", Description: "説明",
    "Quests & missions": "クエストとミッション", "Set goals and XP rewards, and control the quest deadline.": "目標とXP報酬を設定し、期限を管理します。", "Create quest": "クエストを作成", "Create a quest": "クエストを作成", "Edit quest": "クエストを編集", "NEW ORBIT QUEST": "新しいORBITクエスト", "UPDATE ORBIT QUEST": "ORBITクエストを更新", "Quest action failed.": "クエストの操作に失敗しました。", "Quest name": "クエスト名", "Deadline (optional)": "期限（任意）", "XP reward": "XP報酬", Goal: "目標", "Give the crew a challenge.": "クルーに挑戦を用意しましょう。", "Create a quest with a goal and XP reward to get started.": "目標とXP報酬を設定したクエストを作成して始めましょう。",
  },
  ko: {
    "Welcome to ORBIT,": "ORBIT에 오신 것을 환영합니다,",
    "Here are a few good places to start. You can always find them in the menu.": "시작하기 좋은 곳을 소개합니다. 메뉴에서 언제든 다시 찾을 수 있어요.",
    "Got it, let’s go": "좋아요, 시작할게요",
    Close: "닫기",
    "Set a goal and reward for your crew.": "크루의 목표와 보상을 설정하세요.",
    "Bring members together with an event.": "이벤트로 멤버들을 모아보세요.",
    "Share important news with every member.": "모든 멤버에게 중요한 소식을 공유하세요.",
    "See what your ORBIT crew is planning.": "ORBIT 크루의 계획을 확인하세요.",
    "Find members and start a conversation.": "멤버를 찾아 대화를 시작하세요.",
    "Check official news from your ORBIT team.": "ORBIT 팀의 공식 소식을 확인하세요.",
    "Find an event": "이벤트 찾기", "Meet your crew": "크루 만나기", "Read crew updates": "크루 소식 읽기", "Post an update": "소식 게시하기",
    "Updates will appear here when an admin publishes one.": "관리자가 소식을 게시하면 여기에 표시됩니다.",
    "Create first update": "첫 소식 만들기", "Explore events": "이벤트 둘러보기", "Open crew chat": "크루 채팅 열기",
    Messages: "메시지", Blocked: "차단됨",
    "Create events and control their details, visibility, and status.": "이벤트를 만들고 세부 정보, 공개 범위, 상태를 관리하세요.",
    "Create event": "이벤트 만들기", "Create an event": "이벤트 만들기", "Edit event": "이벤트 수정", "NEW ORBIT EVENT": "새 ORBIT 이벤트", "UPDATE ORBIT EVENT": "ORBIT 이벤트 수정",
    "Event action failed.": "이벤트 작업에 실패했습니다.", "Event name": "이벤트 이름", "Date and time": "날짜 및 시간", Location: "장소", "Capacity (optional)": "정원(선택 사항)", Visibility: "공개 범위", "Public to members": "멤버에게 공개", Private: "비공개", Status: "상태", Description: "설명",
    "Quests & missions": "퀘스트 및 미션", "Set goals and XP rewards, and control the quest deadline.": "목표와 XP 보상을 설정하고 퀘스트 기한을 관리하세요.", "Create quest": "퀘스트 만들기", "Create a quest": "퀘스트 만들기", "Edit quest": "퀘스트 수정", "NEW ORBIT QUEST": "새 ORBIT 퀘스트", "UPDATE ORBIT QUEST": "ORBIT 퀘스트 수정", "Quest action failed.": "퀘스트 작업에 실패했습니다.", "Quest name": "퀘스트 이름", "Deadline (optional)": "기한(선택 사항)", "XP reward": "XP 보상", Goal: "목표", "Give the crew a challenge.": "크루에게 도전 과제를 제시하세요.", "Create a quest with a goal and XP reward to get started.": "목표와 XP 보상을 설정한 퀘스트를 만들어 시작하세요.",
  },
  ar: {
    "Welcome to ORBIT,": "مرحبًا بك في ORBIT،",
    "Here are a few good places to start. You can always find them in the menu.": "إليك بعض الأماكن المناسبة للبدء. يمكنك العثور عليها دائمًا في القائمة.",
    "Got it, let’s go": "حسنًا، لنبدأ",
    Close: "إغلاق",
    "Set a goal and reward for your crew.": "حدّد هدفًا ومكافأة لفريقك.",
    "Bring members together with an event.": "اجمع الأعضاء في فعالية.",
    "Share important news with every member.": "شارك الأخبار المهمة مع جميع الأعضاء.",
    "See what your ORBIT crew is planning.": "اطّلع على خطط فريق ORBIT.",
    "Find members and start a conversation.": "اعثر على الأعضاء وابدأ محادثة.",
    "Check official news from your ORBIT team.": "اطّلع على الأخبار الرسمية من فريق ORBIT.",
    "Find an event": "استكشف الفعاليات", "Meet your crew": "تعرّف على فريقك", "Read crew updates": "اقرأ أخبار الفريق", "Post an update": "انشر تحديثًا",
    "Updates will appear here when an admin publishes one.": "ستظهر التحديثات هنا عندما ينشرها أحد المسؤولين.",
    "Create first update": "أنشئ أول تحديث", "Explore events": "استكشف الفعاليات", "Open crew chat": "افتح دردشة الفريق",
    Messages: "الرسائل", Blocked: "محظورون",
    "Create events and control their details, visibility, and status.": "أنشئ الفعاليات وتحكّم في تفاصيلها وإمكانية ظهورها وحالتها.",
    "Create event": "إنشاء فعالية", "Create an event": "إنشاء فعالية", "Edit event": "تعديل الفعالية", "NEW ORBIT EVENT": "فعالية ORBIT جديدة", "UPDATE ORBIT EVENT": "تحديث فعالية ORBIT",
    "Event action failed.": "تعذّر تنفيذ الإجراء على الفعالية.", "Event name": "اسم الفعالية", "Date and time": "التاريخ والوقت", Location: "الموقع", "Capacity (optional)": "السعة (اختياري)", Visibility: "إمكانية الظهور", "Public to members": "متاحة للأعضاء", Private: "خاصة", Status: "الحالة", Description: "الوصف",
    "Quests & missions": "المهام والتحديات", "Set goals and XP rewards, and control the quest deadline.": "حدّد الأهداف ومكافآت XP وتحكّم في موعد انتهاء المهمة.", "Create quest": "إنشاء مهمة", "Create a quest": "إنشاء مهمة", "Edit quest": "تعديل المهمة", "NEW ORBIT QUEST": "مهمة ORBIT جديدة", "UPDATE ORBIT QUEST": "تحديث مهمة ORBIT", "Quest action failed.": "تعذّر تنفيذ الإجراء على المهمة.", "Quest name": "اسم المهمة", "Deadline (optional)": "الموعد النهائي (اختياري)", "XP reward": "مكافأة XP", Goal: "الهدف", "Give the crew a challenge.": "قدّم تحديًا للفريق.", "Create a quest with a goal and XP reward to get started.": "أنشئ مهمة بهدف ومكافأة XP لبدء العمل.",
  },
};

type LanguageContextValue = {
  locale: Locale;
  t: (key: string) => string;
  setLocale: (locale: Locale) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const storageKey = "orbit-language-v1";
const languageChangeEvent = "orbit-language-change";
let memoryLocale: Locale | null = null;

function isLocale(value: string): value is Locale {
  return languages.some((language) => language.code === value);
}

function detectLocale(language: string): Locale {
  const normalized = language.toLowerCase();
  if (normalized.startsWith("pt")) return "pt-BR";
  if (normalized.startsWith("zh")) return "zh-CN";
  const match = languages.find((item) => item.code !== "pt-BR" && item.code !== "zh-CN" && normalized.startsWith(item.code.toLowerCase()));
  return match?.code ?? "en";
}

function getBrowserLocale(): Locale {
  if (memoryLocale) return memoryLocale;
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved && isLocale(saved)) return saved;
  } catch (error) {
    console.error("Could not read the saved ORBIT language preference.", error);
  }
  return detectLocale(navigator.language);
}

function subscribeToLanguage(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) memoryLocale = null;
    callback();
  };
  window.addEventListener(languageChangeEvent, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(languageChangeEvent, callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore<Locale>(subscribeToLanguage, getBrowserLocale, () => "en");
  const setLocale = useCallback((nextLocale: Locale) => {
    memoryLocale = nextLocale;
    try {
      window.localStorage.setItem(storageKey, nextLocale);
    } catch (error) {
      console.error("Could not save the ORBIT language preference.", error);
    }
    window.dispatchEvent(new Event(languageChangeEvent));
  }, []);

  useEffect(() => {
    const language = languages.find((item) => item.code === locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = language?.direction ?? "ltr";
  }, [locale]);

  const value = useMemo<LanguageContextValue>(() => ({
    locale,
    t: (key) => {
      const translationKey = key as TranslationKey;
      return additionalTranslations[locale]?.[translationKey]
        ?? translations[locale][translationKey]
        ?? english[translationKey]
        ?? key;
    },
    setLocale,
  }), [locale, setLocale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within a LanguageProvider.");
  return context;
}

export function LanguageSwitcher() {
  const { locale, t, setLocale } = useLanguage();
  return <label className="language-switcher">
    <span>{t("Language")}</span>
    <select value={locale} aria-label={t("Language")} onChange={(event) => {
      if (isLocale(event.target.value)) setLocale(event.target.value);
    }}>
      {languages.map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}
    </select>
  </label>;
}
