const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Configuração ----------
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'profile.json');
const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------- "Banco de dados" simples (JSON) ----------
function readProfile() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { name: 'Usuário Demo', avatar: null };
  }
}
function saveProfile(profile) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(profile, null, 2));
}

// Espaço total usado na pasta de uploads
function storageUsed() {
  return fs
    .readdirSync(UPLOAD_DIR)
    .reduce((sum, f) => sum + fs.statSync(path.join(UPLOAD_DIR, f)).size, 0);
}

// ---------- Validação real do tipo (magic bytes) ----------
// Não confiamos no mimetype nem na extensão enviados pelo cliente: eles podem ser forjados.
function detectType(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP')
    return 'image/webp';
  return null;
}

// ---------- Multer: recebe em memória, com limite de tamanho ----------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    // 1ª barreira: rejeita rápido pelo mimetype declarado
    if (!ALLOWED_TYPES[file.mimetype]) {
      return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'tipo'));
    }
    cb(null, true);
  },
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

// ---------- Rotas ----------
app.get('/api/profile', (req, res) => {
  res.json({ ...readProfile(), limits: { maxSize: MAX_SIZE, allowedTypes: Object.keys(ALLOWED_TYPES) }, storageUsed: storageUsed() });
});

app.post('/api/profile/avatar', upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

  // 2ª barreira: confere o conteúdo real do arquivo
  const realType = detectType(req.file.buffer);
  if (!realType) {
    return res.status(415).json({ error: 'O conteúdo do arquivo não é uma imagem JPG, PNG ou WebP válida.' });
  }

  // Nome gerado pelo servidor (nunca usar o nome do cliente no disco)
  const filename = crypto.randomUUID() + ALLOWED_TYPES[realType];
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer);

  // Remove o avatar anterior para não acumular lixo
  const profile = readProfile();
  if (profile.avatar) fs.rmSync(path.join(UPLOAD_DIR, profile.avatar.filename), { force: true });

  profile.avatar = {
    filename,
    originalName: path.basename(req.file.originalname),
    mime: realType,
    size: req.file.size,
    uploadedAt: new Date().toISOString(),
    url: '/uploads/' + filename,
    storedAt: 'uploads/' + filename,
  };
  saveProfile(profile);

  res.status(201).json({ ...profile, limits: { maxSize: MAX_SIZE, allowedTypes: Object.keys(ALLOWED_TYPES) }, storageUsed: storageUsed() });
});

app.delete('/api/profile/avatar', (req, res) => {
  const profile = readProfile();
  if (profile.avatar) {
    fs.rmSync(path.join(UPLOAD_DIR, profile.avatar.filename), { force: true });
    profile.avatar = null;
    saveProfile(profile);
  }
  res.json({ ...profile, storageUsed: storageUsed() });
});

// ---------- Tratamento de erros ----------
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `Arquivo muito grande. O máximo é ${MAX_SIZE / 1024 / 1024} MB.` });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(415).json({ error: 'Tipo não permitido. Envie JPG, PNG ou WebP.' });
    }
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Erro interno no servidor.' });
});

app.listen(PORT, () => console.log(`Rodando em http://localhost:${PORT}`));
