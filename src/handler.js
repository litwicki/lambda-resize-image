/**
 * Module dependencies.
 */

import { S3 as _S3 } from 'aws-sdk';
import { generateS3Key } from './lib/utils';
import { isNullOrUndefined } from 'util';
import sharp from 'sharp';

const S3 = new _S3({
  signatureVersion: 'v4',
});

const IMAGE_SIZES = [320, 640, 800, 1024, 1280, 1360, 1920, 2048, 2056, 2560, 3440, 3840, 'AUTO'];

/**
 * Export `imageprocess` module.
 */

export function imageprocess(event, context, callback) {
  const queryParameters = event.queryStringParameters || {};
  const imageKey = decodeURIComponent(event.pathParameters.key);

  if (!process.env.BUCKET) {
    return callback(null, {
      statusCode: 404,
      body: 'Error: Set environment variables BUCKET.',
    });
  }

  const size = {
    width: isNullOrUndefined(queryParameters.width)
      ? null
      : parseInt(queryParameters.width),
    height: isNullOrUndefined(queryParameters.height)
      ? null
      : parseInt(queryParameters.height),
  };

  if (imageKey) {
    if (!size.width && !size.height) {
      S3.getObject({
        Bucket: process.env.BUCKET,
        Key: imageKey,
      })
        .promise()
        .then((data) =>
          sharp(data.Body).jpeg({ quality: 95, progressive: true }).toBuffer()
        )
        .then((buffer) => {
          // generate a binary response with resized image
          const response = {
            statusCode: 200,
            headers: {
              'Content-Type': 'image/jpeg',
              'Cache-Control': 'public, max-age=31536000',
            },
            body: buffer.toString('base64'),
            isBase64Encoded: true,
          };
          return callback(null, response);
        })
        .catch((err) =>
          callback(null, {
            statusCode: err.statusCode || 404,
            body: JSON.stringify(err),
          })
        );
    } else {

      if (!size.width || !IMAGE_SIZES.includes(size.width)) {
        return callback(null, {
          statusCode: 403,
          body: 'Error: Invalid image size.',
        });
      }

      S3.getObject({
        Bucket: process.env.BUCKET,
        Key: imageKey,
      })
        .promise()
        .then((data) =>
          sharp(data.Body)
            .resize({ width: size.width })
            .jpeg({ quality: 95, progressive: true })
            .toBuffer()
        )
        .then((buffer) => {
          S3.putObject({
            Body: buffer,
            Bucket: process.env.BUCKET,
            ContentType: 'image/jpeg',
            CacheControl: 'max-age=31536000',
            Key: generateS3Key(imageKey, size),
            ACL: 'public-read',
          })
            .promise()
            .catch((err) => {
              return callback(null, {
                statusCode: err.statusCode || 404,
                body: JSON.stringify(err),
              });
            });
          // generate a binary response with resized image
          const response = {
            statusCode: 200,
            headers: {
              'Content-Type': 'image/jpeg',
              'Cache-Control': 'public, max-age=31536000',
            },
            body: buffer.toString('base64'),
            isBase64Encoded: true,
          };
          console.log('response', response);
          return callback(null, response);
        })
        .catch((err) =>
          callback(null, {
            statusCode: err.statusCode || 404,
            body: JSON.stringify(err),
          })
        );
    }
  } else {
    return callback(null, {
      statusCode: 404,
      body: 'Error: Image not found.',
    });
  }
}