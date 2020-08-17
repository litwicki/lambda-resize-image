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

  console.log('imageKey', imageKey);

  if (!process.env.BUCKET) {
    let message = 'Error: Set environment variables BUCKET.';
    console.error(message);
    return callback(null, {
      statusCode: 404,
      body: message
    });
  }

  if (!imageKey) {
    let message = 'Error: Image not found.';
    console.error(message);
    return callback(null, {
      statusCode: 404,
      body: message,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
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

  if (!size.width && !size.height) {

    const success = {
      statusCode: '308',
      headers: {
        'location': `${process.env.URL}/${imageKey}`,
        'expires': (new Date((new Date()).setFullYear((new Date()).getFullYear() + 1))).toUTCString(),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: '' //buffer.toString()
    };

    S3.getObject({ Bucket: process.env.BUCKET, Key: imageKey }).promise()
      .then(() => context.succeed(success)
      )
      .catch((err) => context.fail(err))

  } else {

    if (!size.width || !IMAGE_SIZES.includes(size.width)) {
      return callback(null, {
        statusCode: 403,
        body: 'Error: Invalid image size.',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
      });
    }

    S3.getObject({ Bucket: process.env.BUCKET, Key: imageKey }).promise()
      .then((data) => sharp(data.Body)
        .resize(size.width)
        .toFormat('jpeg')
        .toBuffer()
      )
      .then((data) => holdBuffer(data))
      .then((buffer) => S3.putObject({
        Body: buffer,
        Bucket: process.env.BUCKET,
        ContentType: 'image/jpeg',
        Key: generateS3Key(imageKey, size),
        ACL: 'public-read',
        CacheControl: 'public, max-age=31536000'
      }).promise()
      )
      .then(() => context.succeed({
        statusCode: '308',
        headers: {
          'location': `${process.env.URL}/${generateS3Key(imageKey, size)}`,
          'expires': (new Date((new Date()).setFullYear((new Date()).getFullYear() + 1))).toUTCString(),
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: '' //buffer.toString()
      })
      )
      .catch((err) => context.fail(err))

  }

}

var holdBuffer = function (data) {
  let buffer = data;
  return buffer;
}