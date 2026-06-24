import express from 'express';
import multer from 'multer';
import fs from "fs";

import { ZipArchive } from "archiver";
import {spawnSync} from 'child_process';

const app = express();
const port = process.env.PORT ?? 3000;

const tempUploadDir = '/tmp/uploads'
const tempPDFDir = '/tmp/pdf'
const tempOutputDir = '/tmp/outputs'

fs.mkdirSync(tempUploadDir, { recursive: true });
fs.mkdirSync(tempPDFDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    void req;
    void file;
    cb(null, '/tmp/uploads');
  },
  filename: function (req, file, cb) {
    void req;
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.originalname);
  },
});

const upload = multer({ storage: storage });

app.get('/', (req, res) => {
  void req;
  res.send('Hello World!');
});

app.post('/{*path}', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.sendStatus(401);
    res.send("No file uploaded");
    return
  }

  let pdfOutputPath = `${tempPDFDir}/${Date.now() + '-' + Math.round(Math.random() * 1e9)}.pdf`;
  const imageDirectory = `${tempOutputDir}/${Date.now() + '-' + Math.round(Math.random() * 1e9)}/`;

  if (req.file.originalname.endsWith(".pdf")) {
    pdfOutputPath = req.file.path;
  } else {
    const pdfProcess = spawnSync(`pandoc`, ["--pdf-engine", "typst", "-o", pdfOutputPath, req.file?.path])
    if (pdfProcess.status !== 0) {
      res.status(500);
      res.send(`Pandoc failed\n  exit code: ${pdfProcess.status}\n  signal: ${pdfProcess.signal}\n  stdout: ${pdfProcess.stdout}\n  stderr: ${pdfProcess.stderr}`);
      return;
    }
  }

  fs.mkdirSync(imageDirectory, { recursive: true });
  const convertProcess = spawnSync(`convert`, ["-density", '300', "-background", "white", "-alpha", "remove", pdfOutputPath, `${imageDirectory}/page-%03d.png`])
  if (convertProcess.status !== 0) {
    res.status(500);
    res.send(`Convert failed\n  exit code: ${convertProcess.status}\n  signal: ${convertProcess.signal}\n  stdout: ${convertProcess.stdout}\n  stderr: ${convertProcess.stderr}`);
    return;
  }

  const archive = new ZipArchive({
    zlib: { level: 9 },
  });
  res.attachment(`${req.file.originalname}.zip`).type('zip');
  archive.glob("*.png", { cwd: imageDirectory });
  archive.pipe(res);
  await archive.finalize();
})

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});

process.on('SIGINT', function() {
  process.exit();
});
