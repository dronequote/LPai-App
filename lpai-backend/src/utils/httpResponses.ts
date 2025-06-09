import { NextApiResponse } from 'next';

export const sendSuccess = (
  res: NextApiResponse,
  data: any,
  message = 'Success',
  option?: {
    noEmailFound?: boolean
  }
) => {
    const response: any = {
        success: true,
        message,
        data,
      };
    
      if (option?.noEmailFound) {
        response.noEmailFound = true;
      }
    
      return res.status(200).json(response);
};

export const sendBadRequest = (
  res: NextApiResponse,
  error = 'Invalid request',
  message = 'Bad Request'
) => {
  return res.status(400).json({
    success: false,
    message,
    error,
  });
};

export const sendUnauthorized = (
  res: NextApiResponse,
  error = 'Unauthorized',
  message = 'Unauthorized access'
) => {
  return res.status(401).json({
    success: false,
    message,
    error,
  });
};


export const sendServerError = (
  res: NextApiResponse,
  error: any,
  message = 'Server error'
) => {
  return res.status(500).json({
    success: false,
    message,
    error: error?.message || 'Unexpected error',
  });
};
