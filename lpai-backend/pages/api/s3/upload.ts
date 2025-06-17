import type { NextApiRequest, NextApiResponse } from 'next';
import multer from 'multer';
import { uploadToS3 } from '@/utils/s3';
import {
  sendSuccess,
  sendBadRequest,
  sendServerError,
} from '../../../src/utils/httpResponses';
import cors from '@/lib/cors';

export const config = {
  api: {
    bodyParser: false,
  },
};

const upload = multer({ storage: multer.memoryStorage() });

function runMiddleware(req: NextApiRequest, res: NextApiResponse, fn: Function) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  await cors(req, res);
  if (req.method !== 'POST') {
    return sendBadRequest(res, 'Method Not Allowed');
  }

  try {
    // @ts-ignore
    await runMiddleware(req, res, upload.single('file'));

    // @ts-ignore
    const file = req.file;

    if (!file) {
      return sendBadRequest(res, 'No file uploaded');
    }

    const location = await uploadToS3(file);

    return sendSuccess(res, { url: location }, 'File uploaded successfully');
  } catch (err) {
    return sendServerError(res, err, 'Failed to upload file');
  }
};

export default handler;
