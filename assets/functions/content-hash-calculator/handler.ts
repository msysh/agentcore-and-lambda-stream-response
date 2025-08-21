import * as crypto from 'crypto';
import {
  CloudFrontRequestEvent,
  CloudFrontRequestHandler,
  CloudFrontRequestResult,
  Context,
} from 'aws-lambda';

const hashPayload = async (payload: any) => {
  const encoder = new TextEncoder().encode(payload);
  const hash = await crypto.subtle.digest("SHA-256", encoder);
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map((bytes) => bytes.toString(16).padStart(2, "0")).join("");
};

export const handler: CloudFrontRequestHandler = async (event: CloudFrontRequestEvent, context: Context): Promise<CloudFrontRequestResult> => {
  const request = event.Records[0].cf.request;
  console.debug('originalRequest', JSON.stringify(request));

  if (!request.body?.data) {
    return request;
  }

  const body = request.body.data;
  const decodedBody = Buffer.from(body, 'base64').toString('utf-8');

  request.headers['x-amz-content-sha256'] = [
    { key: 'x-amz-content-sha256', value: await hashPayload(decodedBody) },
  ];
  console.debug('modifiedRequest', JSON.stringify(request));

  return request;
};