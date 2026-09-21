// Local-file jukebox: plays the user's OWN audio files (e.g. their Bollywood
// downloads) through a plain <audio> element. Files are turned into
// in-memory object URLs and NEVER leave the browser — nothing is uploaded.

export interface LocalTrack {
  name: string;
  url: string;
}

type Listener = () => void;

class Jukebox {
  private audio: HTMLAudioElement | null = null;
  private bound = false;
  private listeners = new Set<Listener>();
  tracks: LocalTrack[] = [];
  index = 0;
  playing = false;
  shuffle = false;

  private ensure(): HTMLAudioElement {
    if (!this.audio) this.audio = new Audio();
    if (!this.bound && this.audio) {
      this.bound = true;
      this.audio.addEventListener("ended", () => this.next());
      this.audio.addEventListener("play", () => {
        this.playing = true;
        this.emit();
      });
      this.audio.addEventListener("pause", () => {
        this.playing = false;
        this.emit();
      });
    }
    return this.audio;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    this.listeners.forEach((f) => f());
  }

  current(): LocalTrack | null {
    return this.tracks[this.index] ?? null;
  }

  addFiles(files: FileList | File[]) {
    const list = [...files].filter(
      (f) =>
        /^audio\//i.test(f.type) ||
        /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(f.name)
    );
    for (const t of this.tracks) URL.revokeObjectURL(t.url);
    this.tracks = list.map((f) => ({
      name: f.name.replace(/\.[^.]+$/, ""),
      url: URL.createObjectURL(f),
    }));
    this.index = 0;
    if (this.tracks.length) this.playAt(0);
    else this.emit();
  }

  clear() {
    for (const t of this.tracks) URL.revokeObjectURL(t.url);
    this.tracks = [];
    this.index = 0;
    this.ensure().pause();
    this.emit();
  }

  playAt(i: number) {
    if (!this.tracks.length) return;
    this.index = (i + this.tracks.length) % this.tracks.length;
    const a = this.ensure();
    a.src = this.tracks[this.index].url;
    void a.play().catch(() => {});
    this.emit();
  }

  toggle() {
    if (!this.tracks.length) return;
    const a = this.ensure();
    if (a.paused) {
      if (!a.src && this.current()) this.playAt(this.index);
      else void a.play().catch(() => {});
    } else {
      a.pause();
    }
  }

  next() {
    if (!this.tracks.length) return;
    if (this.shuffle) this.playAt(Math.floor(Math.random() * this.tracks.length));
    else this.playAt(this.index + 1);
  }

  prev() {
    if (!this.tracks.length) return;
    this.playAt(this.index - 1);
  }

  toggleShuffle() {
    this.shuffle = !this.shuffle;
    this.emit();
  }

  stop() {
    this.ensure().pause();
  }
}

export const jukebox = new Jukebox();
