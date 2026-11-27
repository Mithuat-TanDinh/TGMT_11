import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Award, BookOpen, Check, CheckCircle2, ChevronDown, CircleHelp,
  Compass, ExternalLink, FileAudio2, Flower2, Gamepad2, Heart, Home, ImagePlus, Lightbulb, LockKeyhole,
  Menu, Music2, Paintbrush, Palette, Pause, Play, Plus, Search, Sparkles, Star, Trash2, Upload, Volume2, X,
} from 'lucide-react';
import {
  getGames, getMedia, getProgress, getSongs, putMedia, removeMedia, saveGames, saveProgress, saveSongs,
  type Grade, type LearningGame, type Progress, type Song,
} from '../lib/storage';

type Section = 'home' | 'music' | 'games' | 'explore' | 'workshop' | 'achievements' | 'teacher';
type Toast = { id: number; message: string; kind: 'ok' | 'error' };
type Modal = 'song' | 'game' | null;

const nav: { id: Section; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Trang chủ', icon: Home },
  { id: 'music', label: 'Góc Âm nhạc', icon: Music2 },
  { id: 'games', label: 'Trò chơi', icon: Gamepad2 },
  { id: 'explore', label: 'Khám phá', icon: Compass },
  { id: 'workshop', label: 'Xưởng sáng tạo', icon: Palette },
  { id: 'achievements', label: 'Thành tích', icon: Award },
];
const gradeLabels = ['Tất cả lớp', 'Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5'];
const activities = [
  { id: 'match', title: 'Ghép hình với câu', desc: 'Tìm đúng hình cho câu miêu tả', icon: '🧩', color: 'lavender' },
  { id: 'steps', title: 'Xếp bước vẽ', desc: 'Sắp xếp các bước để vẽ thật đẹp', icon: '✏️', color: 'peach' },
  { id: 'colors', title: 'Nhà thám hiểm màu sắc', desc: 'Chọn màu thật nhanh nào!', icon: '🎨', color: 'mint' },
  { id: 'shapes', title: 'Hình khối vui nhộn', desc: 'Nhận ra hình cơ bản quanh em', icon: '🔺', color: 'sky' },
  { id: 'artworks', title: 'Bảo tàng tí hon', desc: 'Cùng khám phá sản phẩm Mĩ thuật', icon: '🖼️', color: 'yellow' },
];
const stepCards = ['Tô màu bức tranh', 'Vẽ hình quả táo', 'Phác khung hình bằng nét nhẹ'];

function safeId() { return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
function App() {
  const [section, setSection] = useState<Section>('home');
  const [songs, setSongs] = useState<Song[]>([]);
  const [games, setGames] = useState<LearningGame[]>([]);
  const [progress, setProgress] = useState<Progress>(() => getProgress());
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [editingGame, setEditingGame] = useState<LearningGame | null>(null);
  const [query, setQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('Tất cả lớp');
  const [activeSong, setActiveSong] = useState<Song | null>(null);
  const [playing, setPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [volume, setVolume] = useState(75);
  const [selectedGame, setSelectedGame] = useState<LearningGame | null>(null);
  const [activity, setActivity] = useState('');
  const [question, setQuestion] = useState(0);
  const [stepOrder, setStepOrder] = useState([0, 1, 2]);
  const [menuOpen, setMenuOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    try { setSongs(getSongs()); setGames(getGames()); }
    catch { notify('Trình duyệt chưa cho phép lưu dữ liệu xem trước.', 'error'); }
    setLoading(false);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume / 100;
  }, [volume, audioUrl]);

  function notify(message: string, kind: Toast['kind'] = 'ok') { setToast({ id: Date.now(), message, kind }); }
  function navigate(next: Section) { setSection(next); setMenuOpen(false); setActivity(''); setSelectedGame(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function updateProgress(next: Progress) { setProgress(next); try { saveProgress(next); } catch { notify('Không lưu được tiến độ trên thiết bị này.', 'error'); } }
  function award(id: string, points = 10) {
    setProgress((current) => {
      if (current.completed.includes(id)) return current;
      const badges = current.badges.includes('Mầm sáng tạo') ? current.badges : [...current.badges, 'Mầm sáng tạo'];
      const next = { ...current, points: current.points + points, completed: [...current.completed, id], badges };
      try { saveProgress(next); } catch { /* Keep the current in-memory score for this visit. */ }
      return next;
    });
    notify('Tuyệt vời! Con nhận được điểm sáng tạo rồi!');
  }
  async function playSong(song: Song) {
    try {
      const file = await getMedia(song.audioId);
      if (!file) throw new Error('Không tìm thấy tệp nhạc cục bộ. Hãy tải lại bài hát trên thiết bị này.');
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      const nextUrl = URL.createObjectURL(file);
      setAudioUrl(nextUrl); setActiveSong(song); setPlaying(true);
      window.setTimeout(() => { void audioRef.current?.play().catch(() => setPlaying(false)); }, 40);
    } catch (error) { notify(error instanceof Error ? error.message : 'Không phát được bài hát.', 'error'); }
  }
  function nextTrack(direction: number) {
    if (!songs.length || !activeSong) return;
    const index = songs.findIndex((song) => song.id === activeSong.id);
    const next = songs[(index + direction + songs.length) % songs.length];
    void playSong(next);
  }
  async function deleteSong(song: Song) {
    if (!window.confirm(`Xóa bài “${song.title}” khỏi trình duyệt này?`)) return;
    try {
      await removeMedia(song.audioId);
      if (song.coverId) await removeMedia(song.coverId);
      const next = songs.filter((item) => item.id !== song.id);
      saveSongs(next); setSongs(next);
      if (activeSong?.id === song.id) { setPlaying(false); setActiveSong(null); setAudioUrl(''); }
      notify('Đã xóa bài hát khỏi thiết bị này.');
    } catch { notify('Không xóa được tệp khỏi bộ nhớ trình duyệt.', 'error'); }
  }
  function deleteGame(game: LearningGame) {
    if (!window.confirm(`Xóa trò chơi “${game.title}” khỏi trình duyệt này?`)) return;
    const next = games.filter((item) => item.id !== game.id);
    setGames(next); saveGames(next); notify('Đã xóa trò chơi khỏi thiết bị này.');
  }
  function moveStep(index: number, direction: number) {
    const target = index + direction;
    if (target < 0 || target >= stepOrder.length) return;
    setStepOrder((current) => { const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }
  function checkActivity(answer: string) {
    const answers: Record<string, string[]> = {
      match: ['Chiếc lá có màu xanh', 'Quả bóng có hình tròn', 'Mặt trời tỏa nắng vàng'],
      colors: ['Xanh lá', 'Vàng nắng', 'Xanh da trời'],
      shapes: ['Tròn', 'Tam giác', 'Vuông'],
      artworks: ['Bức tranh vẽ phong cảnh', 'Tượng nặn bằng đất', 'Tranh xé dán giấy màu'],
    };
    if (answer === answers[activity]?.[question]) {
      award(`${activity}-${question}`, 10);
      if (question < 2) setQuestion((value) => value + 1);
      else { setQuestion(3); }
    } else notify('Thử lại nhé, con sắp tìm ra rồi!', 'error');
  }
  function startActivity(id: string) { setActivity(id); setQuestion(0); setStepOrder([0, 1, 2]); }
  const filteredSongs = useMemo(() => songs.filter((song) => {
    const matchesQuery = `${song.title} ${song.theme}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'));
    return matchesQuery && (gradeFilter === 'Tất cả lớp' || String(song.grade) === gradeFilter.replace('Lớp ', ''));
  }), [songs, query, gradeFilter]);
  const filteredGames = useMemo(() => games.filter((game) => gradeFilter === 'Tất cả lớp' || `Lớp ${game.grade}` === gradeFilter), [games, gradeFilter]);

  async function handleSongSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') ?? '').trim();
    const theme = String(form.get('theme') ?? '').trim();
    const lyrics = String(form.get('lyrics') ?? '').trim();
    const gradeRaw = String(form.get('grade') ?? 'Tất cả');
    const audioFile = form.get('audio') as File;
    const coverFile = form.get('cover') as File;
    if (!title) return notify('Con hãy nhập tên bài hát nhé.', 'error');
    if (!editingSong && !audioFile?.size) return notify('Hãy chọn tệp MP3 cần thêm.', 'error');
    if (audioFile?.size && (!audioFile.name.toLowerCase().endsWith('.mp3') || audioFile.size > 15 * 1024 * 1024)) return notify('Chỉ nhận MP3 tối đa 15 MB.', 'error');
    if (coverFile?.size && (!coverFile.type.startsWith('image/') || coverFile.size > 1.5 * 1024 * 1024)) return notify('Ảnh bìa phải là tệp ảnh tối đa 1,5 MB.', 'error');
    try {
      const id = editingSong?.id ?? safeId();
      const audioId = editingSong?.audioId ?? safeId();
      const coverId = coverFile?.size ? safeId() : editingSong?.coverId;
      if (audioFile?.size) await putMedia(audioId, audioFile);
      if (coverFile?.size && coverId) await putMedia(coverId, coverFile);
      const song: Song = { id, title, theme, lyrics, grade: (gradeRaw === 'Tất cả' ? 'Tất cả' : Number(gradeRaw)) as Grade | 'Tất cả', audioId, coverId };
      const next = editingSong ? songs.map((item) => item.id === id ? song : item) : [song, ...songs];
      saveSongs(next); setSongs(next); setModal(null); setEditingSong(null); notify('Đã lưu trên trình duyệt hiện tại.');
    } catch { notify('Lưu tệp thất bại. Hãy kiểm tra dung lượng trống của trình duyệt.', 'error'); }
  }
  function handleGameSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get('title') ?? '').trim();
    const description = String(form.get('description') ?? '').trim();
    const url = String(form.get('url') ?? '').trim();
    const grade = Number(form.get('grade')) as Grade;
    try { const parsed = new URL(url); if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('URL'); }
    catch { return notify('Hãy nhập đường dẫn trò chơi hợp lệ bắt đầu bằng https:// hoặc http://.', 'error'); }
    const game: LearningGame = { id: editingGame?.id ?? safeId(), title, description, url, grade };
    const next = editingGame ? games.map((item) => item.id === game.id ? game : item) : [game, ...games];
    setGames(next); saveGames(next); setModal(null); setEditingGame(null); notify('Đã lưu đường dẫn trên trình duyệt hiện tại.');
  }

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <button className="brand" onClick={() => navigate('home')} aria-label="Về trang chủ">
        <span className="brand-mark"><Paintbrush size={23} strokeWidth={2.4} /></span><span className="brand-text">Thế giới<br/><b>Mĩ thuật</b></span>
      </button>
      <div className="sidebar-caption">MÌNH CÙNG KHÁM PHÁ</div>
      <nav className="side-nav" aria-label="Điều hướng chính">
        {nav.map(({ id, label, icon: Icon }) => <button className={`nav-link ${section === id ? 'nav-active' : ''}`} key={id} onClick={() => navigate(id)}><span className="nav-icon"><Icon size={19}/></span><span>{label}</span>{id === 'workshop' && <span className="nav-spark">✦</span>}</button>)}
      </nav>
      <div className="sidebar-spacer"/>
      <button className="teacher-entry" onClick={() => navigate('teacher')}><span className="teacher-shield"><LockKeyhole size={17}/></span><span><b>Góc giáo viên</b><small>Bản xem trước cục bộ</small></span><ArrowRight size={16}/></button>
      <div className="sidebar-foot"><span className="online-dot"/> Bản xem trước · lưu trên thiết bị này</div>
    </aside>
    {menuOpen && <button className="mobile-scrim" onClick={() => setMenuOpen(false)} aria-label="Đóng menu"/>}
    <main className="main-area">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMenuOpen((v) => !v)} aria-label="Mở menu"><Menu/></button>
        <div className="breadcrumb">Thế giới Mĩ thuật <span>/</span> <b>{nav.find((item) => item.id === section)?.label ?? 'Góc giáo viên'}</b></div>
        <div className="top-actions"><span className="grade-pill"><Flower2 size={15}/> Dành cho lớp 1–5</span><button className="top-avatar" onClick={() => navigate('achievements')} aria-label="Xem thành tích">🌻</button></div>
      </header>
      <div className="preview-banner"><Sparkles size={15}/><span><b>Chế độ xem trước:</b> nội dung lưu cục bộ trên trình duyệt này; chưa có đăng nhập giáo viên an toàn hoặc đồng bộ Supabase.</span></div>
      {section === 'home' && <HomePage navigate={navigate} songs={songs.length} games={games.length} points={progress.points}/>}
      {section === 'music' && <MusicPage songs={filteredSongs} allSongs={songs} query={query} setQuery={setQuery} gradeFilter={gradeFilter} setGradeFilter={setGradeFilter} onAdd={() => { setEditingSong(null); setModal('song'); }} onEdit={(song) => { setEditingSong(song); setModal('song'); }} onDelete={deleteSong} onPlay={playSong} activeSong={activeSong} loading={loading}/>}
      {section === 'games' && <GamesPage games={filteredGames} gradeFilter={gradeFilter} setGradeFilter={setGradeFilter} onAdd={() => { setEditingGame(null); setModal('game'); }} onEdit={(game) => { setEditingGame(game); setModal('game'); }} onDelete={deleteGame} onSelect={setSelectedGame} selected={selectedGame}/>}
      {section === 'explore' && <ExplorePage award={award} completed={progress.completed.includes('explore-map')}/>}
      {section === 'workshop' && <WorkshopPage activity={activity} question={question} stepOrder={stepOrder} setStepOrder={setStepOrder} moveStep={moveStep} start={startActivity} check={checkActivity} award={award} navigate={navigate}/>}
      {section === 'achievements' && <AchievementsPage progress={progress}/>}
      {section === 'teacher' && <TeacherPage songs={songs.length} games={games.length} onSongs={() => navigate('music')} onGames={() => navigate('games')} onTasks={() => navigate('workshop')}/>}
      <footer className="footer"><span>☀️ Học vui · Vẽ đẹp · Khám phá mỗi ngày</span><span>Thế giới Mĩ thuật <i>·</i> Bản xem trước</span></footer>
    </main>
    {activeSong && <div className="player-dock"><div className="dock-art">{activeSong.coverId ? <CoverArt id={activeSong.coverId}/> : <span>🎵</span>}</div><div className="dock-meta"><b>{activeSong.title}</b><small>{activeSong.theme || 'Góc Âm nhạc'}</small></div><div className="dock-controls"><button onClick={() => nextTrack(-1)} aria-label="Bài trước"><ArrowLeft size={18}/></button><button className="dock-play" onClick={() => { if (playing) { audioRef.current?.pause(); setPlaying(false); } else { void audioRef.current?.play().then(() => setPlaying(true)).catch(() => notify('Không phát được bài hát.', 'error')); } }} aria-label={playing ? 'Tạm dừng' : 'Phát'}>{playing ? <Pause size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>}</button><button onClick={() => nextTrack(1)} aria-label="Bài tiếp"><ArrowRight size={18}/></button></div><Volume2 size={17} className="volume-icon"/><input aria-label="Âm lượng" type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))}/><button className="dock-close" onClick={() => { setPlaying(false); setActiveSong(null); setAudioUrl(''); }} aria-label="Đóng trình phát"><X size={17}/></button><audio ref={audioRef} src={audioUrl || undefined} onEnded={() => nextTrack(1)} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)}/></div>}
    {modal && <ModalShell title={modal === 'song' ? (editingSong ? 'Chỉnh sửa bài hát' : 'Thêm bài hát mới') : (editingGame ? 'Chỉnh sửa trò chơi' : 'Thêm trò chơi')} onClose={() => { setModal(null); setEditingSong(null); setEditingGame(null); }}>
      {modal === 'song' ? <form className="form-stack" onSubmit={handleSongSave}>
        <label>Tên bài hát <input name="title" defaultValue={editingSong?.title} required maxLength={80} placeholder="Ví dụ: Màu sắc quanh em"/></label>
        <div className="form-row"><label>Chủ đề <input name="theme" defaultValue={editingSong?.theme} maxLength={60} placeholder="Màu sắc, thiên nhiên…"/></label><label>Khối lớp <select name="grade" defaultValue={editingSong?.grade ?? 'Tất cả'}><option value="Tất cả">Tất cả lớp</option>{[1,2,3,4,5].map((g) => <option key={g} value={g}>Lớp {g}</option>)}</select></label></div>
        <label>Tệp MP3 {editingSong && <small> · Để trống nếu giữ tệp hiện tại</small>}<input name="audio" type="file" accept=".mp3,audio/mpeg" required={!editingSong}/><small>Chỉ nhận .mp3 · tối đa 15 MB · lưu trên trình duyệt này.</small></label>
        <label>Ảnh bìa (không bắt buộc)<input name="cover" type="file" accept="image/png,image/jpeg,image/webp"/><small>Tối đa 1,5 MB.</small></label>
        <label>Lời bài hát (không bắt buộc)<textarea name="lyrics" rows={3} maxLength={2000} defaultValue={editingSong?.lyrics} placeholder="Nhập lời bài hát ở đây…"/></label>
        <div className="form-warning"><LockKeyhole size={16}/> Bản xem trước: bài hát chỉ lưu trên trình duyệt hiện tại, chưa tải lên kho dùng chung.</div><button className="btn-primary" type="submit"><Check size={17}/> Lưu bài hát</button>
      </form> : <form className="form-stack" onSubmit={handleGameSave}>
        <label>Tên trò chơi <input name="title" defaultValue={editingGame?.title} maxLength={80} required placeholder="Ví dụ: Sắc màu kỳ diệu"/></label><label>Mô tả <textarea name="description" defaultValue={editingGame?.description} maxLength={300} rows={3} placeholder="Trò chơi giúp các bạn…"/></label><div className="form-row"><label>Khối lớp <select name="grade" defaultValue={editingGame?.grade ?? 1}>{[1,2,3,4,5].map((g) => <option value={g} key={g}>Lớp {g}</option>)}</select></label><label>Đường dẫn URL <input name="url" type="url" defaultValue={editingGame?.url} required placeholder="https://ten-game.netlify.app"/></label></div><div className="form-warning"><LockKeyhole size={16}/> Đường dẫn lưu trong trình duyệt này; trang đích có thể không cho phép nhúng.</div><button className="btn-primary" type="submit"><Check size={17}/> Lưu trò chơi</button>
      </form>}
    </ModalShell>}
    {toast && <div key={toast.id} className={`toast toast-${toast.kind}`} role="status">{toast.kind === 'ok' ? <CheckCircle2 size={19}/> : <CircleHelp size={19}/>} {toast.message}</div>}
  </div>;
}

function HomePage({ navigate, songs, games, points }: { navigate: (s: Section) => void; songs: number; games: number; points: number }) {
  return <div className="page-content home-page">
    <section className="hero-card"><img className="hero-illustration" src="/manus-storage/async-images/56YaD4nFsIbNYxcqxUM818/image-1.webp" alt="Làng quê vui tươi với các bạn nhỏ cùng khám phá nghệ thuật"/><div className="hero-content"><span className="eyebrow"><Sparkles size={14}/> MỖI NGÀY MỘT ĐIỀU MỚI</span><h1>Chào mừng đến<br/>với <em>thế giới sắc màu!</em></h1><p>Nơi những nét vẽ, giai điệu và trò chơi đưa chúng mình đến thật nhiều điều thú vị.</p><button className="hero-button" onClick={() => navigate('workshop')}>Bắt đầu khám phá <ArrowRight size={17}/></button></div><div className="hero-sticker">Hôm nay<br/><b>thật tuyệt!</b><span>✦</span></div><div className="hero-doodle">✿</div></section>
    <div className="section-intro"><div><span className="eyebrow">BẢN ĐỒ KHÁM PHÁ</span><h2>Chọn điểm dừng tiếp theo</h2><p>Mỗi góc nhỏ đều có điều mới chờ con tìm thấy.</p></div><span className="map-chip"><Compass size={16}/> Hành trình của con</span></div>
    <div className="station-grid">
      <Station icon="🎨" label="Xưởng sáng tạo" detail="5 hoạt động vui nhộn" color="mint" onClick={() => navigate('workshop')} ribbon="CHƠI NGAY"/>
      <Station icon="🎵" label="Góc Âm nhạc" detail={songs ? `${songs} bài hát trên thiết bị này` : 'Bài hát do cô thêm sẽ hiện ở đây'} color="peach" onClick={() => navigate('music')} />
      <Station icon="🧩" label="Trò chơi học tập" detail={games ? `${games} trò chơi đã lưu` : 'Khám phá theo từng khối lớp'} color="lavender" onClick={() => navigate('games')} />
      <Station icon="🌳" label="Thế giới khám phá" detail="Hành trình làng quê cổ tích" color="sky" onClick={() => navigate('explore')} ribbon="ĐANG MỞ RỘNG"/>
    </div>
    <div className="home-bottom-row"><div className="home-tip"><span className="tip-icon"><Lightbulb size={21}/></span><div><b>Mẹo nhỏ hôm nay</b><p>Hãy nhìn quanh lớp xem có những màu sắc nào nhé!</p></div><span className="tip-spark">✦</span></div><button className="score-card" onClick={() => navigate('achievements')}><span className="score-emoji">🌟</span><span><small>ĐIỂM SÁNG TẠO</small><b>{points} điểm</b></span><ArrowRight size={17}/></button></div>
  </div>;
}
function Station({ icon, label, detail, color, onClick, ribbon }: { icon: string; label: string; detail: string; color: string; onClick: () => void; ribbon?: string }) {
  return <button className={`station-card bg-${color}`} onClick={onClick}>{ribbon && <span className="station-ribbon">{ribbon}</span>}<span className="station-emoji">{icon}</span><span className="station-copy"><b>{label}</b><small>{detail}</small></span><span className="station-arrow"><ArrowRight size={16}/></span><span className="station-sun">✦</span></button>;
}
function PageHeader({ tag, title, desc, action, actionLabel, icon }: { tag: string; title: string; desc: string; action?: () => void; actionLabel?: string; icon: string }) {
  return <div className="page-header"><div className="page-header-icon">{icon}</div><div className="page-header-copy"><span className="eyebrow">{tag}</span><h1>{title}</h1><p>{desc}</p></div>{action && <button className="btn-primary header-action" onClick={action}><Plus size={17}/>{actionLabel}</button>}</div>;
}
function MusicPage({ songs, allSongs, query, setQuery, gradeFilter, setGradeFilter, onAdd, onEdit, onDelete, onPlay, activeSong, loading }: { songs: Song[]; allSongs: Song[]; query: string; setQuery: (s: string) => void; gradeFilter: string; setGradeFilter: (s: string) => void; onAdd: () => void; onEdit: (song: Song) => void; onDelete: (song: Song) => void; onPlay: (song: Song) => void; activeSong: Song | null; loading: boolean }) {
  return <div className="page-content"><PageHeader tag="GIAI ĐIỆU VUI TƯƠI" title="Góc Âm nhạc" desc="Nghe lại những bài hát cô và các bạn cùng yêu thích." icon="🎵" action={onAdd} actionLabel="Thêm bài hát"/><div className="library-note"><span className="note-paint">♫</span><span><b>Âm nhạc làm ý tưởng bay xa!</b><small>Thư viện cục bộ · {allSongs.length} bài hát trên trình duyệt này</small></span><span className="note-doodle">♪　✿　♫</span></div><div className="toolbar"><div className="search-box"><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm bài hát hoặc chủ đề…" aria-label="Tìm bài hát"/></div><label className="filter-select"><span className="sr-only">Lọc theo lớp</span><select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)}>{gradeLabels.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15}/></label></div>
    {loading ? <p className="loading-note">Đang mở thư viện trên thiết bị này…</p> : songs.length ? <div className="song-list">{songs.map((song, index) => <div className={`song-row ${activeSong?.id === song.id ? 'song-playing' : ''}`} key={song.id}><button className={`song-play ${['peach','mint','lavender','sky'][index%4]}`} onClick={() => onPlay(song)} aria-label={`Phát ${song.title}`}>{activeSong?.id === song.id ? <Pause size={19}/> : <Play size={19} fill="currentColor"/>}</button><CoverArt id={song.coverId}/><div className="song-details"><b>{song.title}</b><small>{song.theme || 'Chưa phân chủ đề'} <i>·</i> {song.grade === 'Tất cả' ? 'Tất cả lớp' : `Lớp ${song.grade}`}</small></div><span className="song-badge">MP3</span><div className="row-actions"><button onClick={() => onEdit(song)} aria-label="Sửa bài hát">Sửa</button><button onClick={() => onDelete(song)} aria-label="Xóa bài hát"><Trash2 size={15}/></button></div></div>)}</div> : <EmptyState icon="🎶" title={allSongs.length ? 'Chưa tìm thấy bài phù hợp' : 'Góc nhạc đang chờ giai điệu đầu tiên'} detail={allSongs.length ? 'Thử từ khóa hoặc chọn một khối lớp khác nhé.' : 'Cô giáo có thể thêm bài hát MP3 để cả lớp cùng nghe.'} action={!allSongs.length ? onAdd : undefined} actionLabel="Thêm bài hát đầu tiên"/>}
    <p className="fine-print"><LockKeyhole size={14}/> Bản xem trước lưu MP3 trên trình duyệt hiện tại; chưa tải lên kho chung.</p></div>;
}
function CoverArt({ id }: { id?: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => { let url = ''; let alive = true; if (id) void getMedia(id).then((blob) => { if (blob && alive) { url = URL.createObjectURL(blob); setSrc(url); } }).catch(() => undefined); return () => { alive = false; if (url) URL.revokeObjectURL(url); }; }, [id]);
  return <span className="cover-art">{src ? <img src={src} alt="Ảnh bìa bài hát"/> : <span>🎨</span>}</span>;
}
function EmptyState({ icon, title, detail, action, actionLabel }: { icon: string; title: string; detail: string; action?: () => void; actionLabel?: string }) {
  return <div className="empty-state"><span className="empty-illustration">{icon}</span><h3>{title}</h3><p>{detail}</p>{action && <button className="btn-secondary" onClick={action}><Plus size={16}/>{actionLabel}</button>}</div>;
}
function GamesPage({ games, gradeFilter, setGradeFilter, onAdd, onEdit, onDelete, onSelect, selected }: { games: LearningGame[]; gradeFilter: string; setGradeFilter: (s: string) => void; onAdd: () => void; onEdit: (game: LearningGame) => void; onDelete: (game: LearningGame) => void; onSelect: (game: LearningGame | null) => void; selected: LearningGame | null }) {
  return <div className="page-content"><PageHeader tag="HỌC QUA TRÒ CHƠI" title="Trò chơi học tập" desc="Chọn một trò chơi phù hợp với khối lớp của con." icon="🧩" action={onAdd} actionLabel="Thêm trò chơi"/><div className="grade-tabs">{gradeLabels.map((item) => <button key={item} className={gradeFilter===item?'grade-active':''} onClick={() => setGradeFilter(item)}>{item}</button>)}</div>
    {selected ? <div className="game-player"><div className="game-player-top"><div><span className="eyebrow">{selected.title} · LỚP {selected.grade}</span><p>{selected.description}</p></div><button className="icon-button" onClick={() => onSelect(null)} aria-label="Đóng trò chơi"><X/></button></div><iframe title={selected.title} src={selected.url} sandbox="allow-scripts allow-forms allow-popups" referrerPolicy="no-referrer" allow="fullscreen"/><p className="embed-hint"><CircleHelp size={15}/> Nếu khung trò chơi trống, trang đích có thể chặn nhúng. <a href={selected.url} target="_blank" rel="noopener noreferrer">Mở trò chơi ở cửa sổ mới <ExternalLink size={14}/></a></p></div> : games.length ? <div className="game-grid">{games.map((game,index) => <article className={`game-card bg-${['lavender','mint','peach','sky'][index%4]}`} key={game.id}><div className="game-card-art">{['🪁','🌈','🐞','🍀'][index%4]}<span>✦</span></div><div className="game-card-copy"><span className="grade-tag">Lớp {game.grade}</span><h3>{game.title}</h3><p>{game.description || 'Cùng khám phá và học điều mới nhé!'}</p><div className="game-card-actions"><button className="btn-primary" onClick={() => onSelect(game)}><Play size={15} fill="currentColor"/> Chơi ngay</button><a className="external-link" href={game.url} target="_blank" rel="noopener noreferrer" title="Mở ở tab mới"><ExternalLink size={17}/></a><button className="text-action" onClick={() => onEdit(game)}>Sửa</button><button className="text-action" onClick={() => onDelete(game)}>Xóa</button></div></div></article>)}</div> : <EmptyState icon="🪁" title="Chưa có trò chơi trong thư viện" detail="Giáo viên có thể thêm đường dẫn đến trò chơi đã xuất bản; website sẽ không sửa mã nguồn trò chơi." action={onAdd} actionLabel="Thêm URL trò chơi"/>}
    <p className="fine-print"><LockKeyhole size={14}/> URL trò chơi lưu trên trình duyệt này. Một số website không cho phép hiển thị trong iframe.</p></div>;
}
function ExplorePage({ award, completed }: { award: (id: string, points?: number) => void; completed: boolean }) {
  const [picked, setPicked] = useState('');
  return <div className="page-content"><PageHeader tag="HÀNH TRÌNH LÀNG QUÊ" title="Thế giới Khám phá" desc="Một chuyến phiêu lưu nghệ thuật đang dần mở ra." icon="🧭"/><div className="explore-banner"><img src="/manus-storage/async-images/56YaD4nFsIbNYxcqxUM818/image-2.webp" alt="Bản đồ làng quê cổ tích với nhiều điểm khám phá"/><div className="map-overlay-note"><span className="eyebrow">BẢN ĐỒ KHÁM PHÁ</span><h2>Mỗi con đường<br/>là một câu chuyện!</h2><p>Ghé thăm các địa điểm và tìm mảnh ghép sắc màu.</p></div><button className="map-stop stop-school" onClick={() => setPicked('Trường học')} aria-label="Khám phá trường học">🏫<small>Trường học</small></button><button className="map-stop stop-pond" onClick={() => setPicked('Bờ ao')} aria-label="Khám phá bờ ao">🪷<small>Bờ ao</small></button><button className="map-stop stop-grove" onClick={() => setPicked('Rặng tre')} aria-label="Khám phá rặng tre">🎋<small>Rặng tre</small></button><span className="map-path-label">✦　●　●　✦</span></div><div className="explore-lower"><div className="quest-card"><span className="quest-icon">🪄</span><div><span className="eyebrow">NHIỆM VỤ NHỎ</span><h3>{picked ? `Con đã ghé ${picked}!` : 'Tìm ba sắc màu quanh em'}</h3><p>{picked ? 'Mỗi nơi con ghé thăm đều mở ra một điều hay.' : 'Chọn một điểm dừng trên bản đồ để bắt đầu chuyến đi.'}</p></div><button className="btn-secondary" onClick={() => picked ? award('explore-map', 15) : setPicked('Cánh đồng')}>{completed ? <><Check size={16}/> Đã hoàn thành</> : picked ? 'Nhận 15 điểm' : 'Bắt đầu nhiệm vụ'}</button></div><div className="coming-card"><span>🌾</span><b>Nhân vật, vật phẩm và nhiệm vụ mới</b><small>Khu vực này sẽ phát triển thành trò chơi phiêu lưu riêng ở giai đoạn tiếp theo.</small></div></div></div>;
}
function WorkshopPage({ activity, question, stepOrder, setStepOrder, moveStep, start, check, award, navigate }: { activity: string; question: number; stepOrder: number[]; setStepOrder: (fn: (o: number[])=>number[])=>void; moveStep: (i:number,d:number)=>void; start: (id:string)=>void; check: (a:string)=>void; award: (id:string,p?:number)=>void; navigate:(s:Section)=>void }) {
  const chosen = activities.find((item) => item.id === activity);
  const [stepFeedback, setStepFeedback] = useState('');
  function checkSteps() { if (stepOrder.join(',') === '2,1,0') { award('steps-order', 15); setStepFeedback('Chính xác! Mình đi từ nét phác đến bức tranh hoàn chỉnh.'); } else { setStepFeedback('Gần đúng rồi! Hãy bắt đầu bằng nét phác khung hình nhé.'); } }
  return <div className="page-content"><PageHeader tag="THỬ SỨC SÁNG TẠO" title="Xưởng Sáng tạo" desc="Mỗi trò chơi nhỏ là một ý tưởng nghệ thuật mới!" icon="🎨"/>
    {activity ? <div className="activity-panel"><button className="back-link" onClick={() => { start(''); setStepFeedback(''); }}><ArrowLeft size={16}/> Tất cả hoạt động</button><div className="activity-title"><span>{chosen?.icon ?? '✏️'}</span><div><span className="eyebrow">HOẠT ĐỘNG SÁNG TẠO</span><h2>{chosen?.title}</h2></div></div>
      {activity==='steps' ? <div className="exercise"><p>Hãy sắp xếp các bước theo đúng thứ tự để vẽ một quả táo nhé!</p><div className="step-list">{stepOrder.map((item,index)=><div className="step-row" key={item}><span className="step-number">{index+1}</span><b>{stepCards[item]}</b><div><button disabled={index===0} onClick={()=>moveStep(index,-1)} aria-label="Chuyển lên"><ArrowUp size={17}/></button><button disabled={index===2} onClick={()=>moveStep(index,1)} aria-label="Chuyển xuống"><ArrowDown size={17}/></button></div></div>)}</div><button className="btn-primary" onClick={checkSteps}>Kiểm tra thứ tự <Check size={16}/></button>{stepFeedback && <p className="feedback">{stepFeedback}</p>}</div> : question >= 3 ? <div className="exercise done-exercise"><span>🏅</span><h3>Con làm tốt lắm!</h3><p>Con đã hoàn thành các câu hỏi trong lượt này.</p><button className="btn-secondary" onClick={()=>start(activity)}>Chơi lại</button></div> : <Question activity={activity} question={question} check={check}/>}
    </div> : <><div className="workshop-banner"><div><span className="eyebrow">THỬ · SAI · KHÁM PHÁ</span><h2>Ý tưởng nào cũng<br/><em>đáng được vẽ!</em></h2><p>Chọn hoạt động con thích để bắt đầu.</p></div><div className="workshop-illustration">🖌️<span>🎨</span><small>✦　✿　✦</small></div></div><div className="activity-grid">{activities.map((item,index)=><button key={item.id} className={`activity-card bg-${item.color}`} onClick={()=>start(item.id)}><span className="activity-count">0{index+1}</span><span className="activity-icon">{item.icon}</span><b>{item.title}</b><small>{item.desc}</small><span className="activity-start">Chơi thử <ArrowRight size={15}/></span></button>)}</div></>}
    <div className="privacy-note"><Heart size={15}/> Tiến độ lưu cục bộ trên trình duyệt này, không cần nhập tên hay thông tin riêng tư.</div></div>;
}
function Question({activity,question,check}:{activity:string;question:number;check:(s:string)=>void}) {
  const prompts: Record<string,{title:string;answers:string[]}> = {
    match:{title:['Câu nào hợp với chiếc lá?','Vật nào có hình tròn?','Điều gì tỏa nắng vàng?'][question],answers:[['Chiếc lá có màu xanh','Đám mây bay trên trời','Con cá bơi dưới nước'][question],['Quả bóng có hình tròn','Que kem dài thật dài','Chiếc lá có màu xanh'][question],['Mặt trời tỏa nắng vàng','Chiếc lá có màu xanh','Quả bóng có hình tròn'][question]]},
    colors:{title:['Lá cây thường có màu gì?','Mặt trời thường có màu nào?','Bầu trời trong veo có sắc gì?'][question],answers:[['Xanh lá','Hồng tím','Nâu đất'][question],['Vàng nắng','Xanh lá','Đỏ cam'][question],['Xanh da trời','Vàng nắng','Xanh lá'][question]]},
    shapes:{title:['Quả bóng thường giống hình nào?','Mái nhà nhọn giống hình gì?','Cửa sổ vuông có mấy cạnh bằng nhau?'][question],answers:[['Tròn','Tam giác','Vuông'][question],['Tam giác','Tròn','Vuông'][question],['Vuông','Tam giác','Tròn'][question]]},
    artworks:{title:['Bức tranh phong cảnh là sản phẩm gì?','Đất nặn có thể tạo thành sản phẩm nào?','Giấy màu xé dán tạo ra gì?'][question],answers:[['Bức tranh vẽ phong cảnh','Tượng nặn bằng đất','Tranh xé dán giấy màu'][question],['Tượng nặn bằng đất','Tranh xé dán giấy màu','Bức tranh vẽ phong cảnh'][question],['Tranh xé dán giấy màu','Bức tranh vẽ phong cảnh','Tượng nặn bằng đất'][question]]},
  };
  const item=prompts[activity];
  return <div className="exercise"><div className="question-meta">CÂU {question+1} / 3 <span className="question-progress"><i style={{width:`${(question+1)*33.333}%`}}/></span></div><h3>{item?.title ?? 'Chọn một hoạt động để chơi nhé!'}</h3><div className="answer-list">{(item?.answers ?? []).map((answer,index)=><button key={answer} onClick={()=>check(answer)}><span>{['A','B','C'][index]}</span>{answer}<ArrowRight size={16}/></button>)}</div></div>;
}
function AchievementsPage({progress}:{progress:Progress}) {
  const all=activities.length+1;
  return <div className="page-content"><PageHeader tag="MỖI BƯỚC ĐỀU ĐÁNG TỰ HÀO" title="Thành tích của con" desc="Những điều mới con đã khám phá trên thiết bị này." icon="🏅"/><div className="achievement-summary"><div className="points-orbit"><span>🌟</span><b>{progress.points}</b><small>ĐIỂM SÁNG TẠO</small></div><div className="achievement-summary-copy"><span className="eyebrow">MỖI NÉT VẼ LÀ MỘT TIẾN BỘ</span><h2>Con đang làm rất tốt!</h2><p>Tiếp tục khám phá để sưu tập thêm huy hiệu nhé.</p><div className="progress-track"><i style={{width:`${Math.min(100, progress.completed.length/all*100)}%`}}/></div><small>{progress.completed.length} nhiệm vụ đã hoàn thành</small></div></div><h2 className="subheading">Bộ sưu tập huy hiệu</h2><div className="badge-grid">{['Mầm sáng tạo','Người bạn sắc màu','Nhà thám hiểm'].map((badge,index)=>{const earned=progress.badges.includes(badge)||(index===1&&progress.completed.includes('explore-map'));return <div className={`badge-card ${earned?'badge-earned':'badge-locked'}`} key={badge}><span>{['🌱','🌈','🧭'][index]}</span><b>{badge}</b><small>{earned?'Đã mở khóa':'Hoàn thành thử thách để nhận'}</small>{earned&&<CheckCircle2 size={16}/>}</div>})}</div><div className="privacy-note"><LockKeyhole size={15}/> Thành tích chỉ lưu trong trình duyệt này, không gắn với tên hoặc hồ sơ cá nhân.</div></div>;
}
function TeacherPage({songs,games,onSongs,onGames,onTasks}:{songs:number;games:number;onSongs:()=>void;onGames:()=>void;onTasks:()=>void}) {
  return <div className="page-content"><PageHeader tag="KHU VỰC DÀNH CHO GIÁO VIÊN" title="Góc giáo viên" desc="Quản lý nội dung trong phiên bản xem trước trên thiết bị này." icon="👩‍🏫"/><div className="admin-warning"><div><LockKeyhole size={20}/></div><span><b>Chưa bật đăng nhập an toàn</b><small>Đây chưa phải khu vực được bảo vệ bằng tài khoản. Mọi dữ liệu chỉ lưu cục bộ trong trình duyệt này. Không nhập thông tin học sinh thật; không dùng như hệ thống quản trị công khai.</small></span></div><div className="teacher-stats"><div><span>🎵</span><b>{songs}</b><small>Bài hát cục bộ</small></div><div><span>🧩</span><b>{games}</b><small>Trò chơi cục bộ</small></div><div><span>📝</span><b>0</b><small>Nhiệm vụ dùng chung</small></div></div><h2 className="subheading">Quản lý nội dung xem trước</h2><div className="admin-actions"><button onClick={onSongs}><span>🎵</span><b>Thư viện âm nhạc</b><small>Thêm, sửa, xóa bài hát</small><ArrowRight size={17}/></button><button onClick={onGames}><span>🧩</span><b>Liên kết trò chơi</b><small>Quản lý trò chơi theo khối lớp</small><ArrowRight size={17}/></button><button onClick={onTasks}><span>✏️</span><b>Nhiệm vụ học tập</b><small>Xem hoạt động trong xưởng</small><ArrowRight size={17}/></button></div><p className="fine-print"><LockKeyhole size={14}/> Khi tích hợp Supabase, cần Auth, chính sách RLS cho dữ liệu và Storage trước khi bật quyền quản trị thật.</p></div>;
}
function ModalShell({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}) {
  useEffect(()=>{function key(event:KeyboardEvent){if(event.key==='Escape')onClose();}window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onClose]);
  return <div className="modal-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose();}}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Đóng"><X/></button></div>{children}</section></div>;
}
export default App;
