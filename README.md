# Upload de foto de perfil com preview

Projeto simples em **Node.js + Express + Multer** (sem build, sem framework no front).

O usuário escolhe uma imagem, vê o **preview** antes de salvar, envia com **barra de progresso**,
e a foto passa a aparecer no perfil. A tela mostra também as regras de **validação** e os dados de **armazenamento**.

## Como rodar

```bash
npm install
npm start
# abra http://localhost:3000
```

## Estrutura

```
upload-perfil/
├── package.json
├── server.js          # API, validação e gravação em disco
├── public/
│   └── index.html     # interface (preview, progresso, painéis)
├── uploads/           # criada automaticamente: imagens salvas
└── data/
    └── profile.json   # criada automaticamente: dados do perfil
```

## Como funciona

### Preview (cliente)
`URL.createObjectURL(file)` mostra a imagem localmente, antes de qualquer envio.

### Validação de tipo e tamanho
Em duas camadas, porque a validação do navegador pode ser contornada:

| Camada | O que valida |
|---|---|
| Cliente (`index.html`) | Tipo (JPG/PNG/WebP) e tamanho (até 2 MB), para dar feedback imediato |
| Servidor – Multer | Limite de tamanho (`413`) e mimetype declarado (`415`) |
| Servidor – magic bytes | Confere os primeiros bytes do arquivo para garantir que é mesmo JPG, PNG ou WebP (`415`) |

### Armazenamento
- A imagem é gravada em `uploads/` com **nome aleatório (UUID)** e extensão definida pelo tipo detectado. O nome enviado pelo cliente nunca é usado no disco (evita path traversal e colisões).
- Ao trocar a foto, a anterior é apagada.
- Os metadados (nome original, tipo, tamanho, data, caminho) ficam em `data/profile.json`.
- O painel "Armazenamento" mostra onde o arquivo foi salvo, tipo, tamanho e o total usado na pasta.

### API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/profile` | Perfil, limites e espaço usado |
| POST | `/api/profile/avatar` | Campo `avatar` (multipart). Retorna `201` |
| DELETE | `/api/profile/avatar` | Remove a foto salva |

## Para levar a produção

Este projeto é uma base didática, com um único usuário fixo. Em um app real você precisaria de:

- **Autenticação**: salvar o avatar por usuário (`userId`) e proteger as rotas.
- **Banco de dados** no lugar do `profile.json` (PostgreSQL, MongoDB etc.).
- **Storage em nuvem** (S3, Cloudflare R2, Cloudinary) no lugar da pasta local, guardando só a URL/chave no banco.
- **Redimensionamento e otimização** (ex.: biblioteca `sharp`, gerando 256×256) e remoção de metadados EXIF.
- **Rate limiting** e, se aceitar arquivos maiores, upload em streaming em vez de memória.

## Ideias de evolução

- Recorte (crop) circular antes de enviar
- Várias miniaturas por imagem
- Teste automatizado das validações (arquivo `.txt` renomeado para `.jpg`, arquivo de 3 MB etc.)
