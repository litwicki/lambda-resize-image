/**
 * Module dependencies.
 */

import { S3 as _S3 } from 'aws-sdk';
import { crop, resize } from 'imagemagick';
import { tmpDir } from 'os';
import { resizeCallback, generateS3Key } from './utils';

/**
 * Export `getImage` util.
 */

export function getImage(key) {
  return new Promise((resolve, reject) => {
    const S3 = new _S3({
      signatureVersion: 'v4',
    });

    S3.getObject(
      {
        Bucket: process.env.BUCKET,
        Key: key,
      },
      (err) => {
        if (err) return reject(err);

        resolve({
          statusCode: 301,
          headers: {
            Location: `${process.env.URL}/${key}`,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Access-Control-Allow-Origin',
            'Access-Control-Allow-Credentials': true,
            'Access-Control-Allow-Methods': 'OPTIONS, GET',
          },
        });
      }
    );
  });
}

/**
 * Export `checkKeyExists` util.
 */

export function checkKeyExists(key, size) {
  return new Promise((resolve, reject) => {
    const S3 = new _S3({
      signatureVersion: 'v4',
    });

    S3.headObject(
      {
        Bucket: process.env.BUCKET,
        Key: generateS3Key(key, size),
      },
      (err) => {
        if (err && err.code === 'NotFound')
          return resizeImage(key, size).then(resolve).catch(reject);

        resolve({
          statusCode: 301,
          headers: {
            Location: `${process.env.CDN_URL}/${generateS3Key(key, size)}`,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,Access-Control-Allow-Origin',
            'Access-Control-Allow-Credentials': true,
            'Access-Control-Allow-Methods': 'OPTIONS, GET',
          },
        });
      }
    );
  });
}

/**
 * Export `resizeImage` util.
 */

export function resizeImage(key, size) {
  return new Promise((resolve, reject) => {
    const S3 = new _S3({
      signatureVersion: 'v4',
    });

    S3.getObject(
      {
        Bucket: process.env.BUCKET,
        Key: key,
      },
      (err, data) => {
        if (err) return reject(err);

        if (size.width && size.height) {
          const tmpImageName = `${tmpDir}/resized.${process.env.BUCKET}.${size.width}.${size.height}`;

          crop(
            {
              width: size.width,
              height: size.height,
              srcData: data.Body,
              dstPath: tmpImageName,
              quality: 1,
              gravity: 'Center',
            },
            (err) => {
              if (err) return reject(err);

              resolve(
                resizeCallback(
                  err,
                  data.ContentType,
                  generateS3Key(key, size),
                  tmpImageName
                )
              );
            }
          );
        } else if (size.width) {
          const tmpImageName = `${tmpDir}/resized.${process.env.BUCKET}.${size.width}`;

          resize(
            {
              width: size.width,
              srcData: data.Body,
              dstPath: tmpImageName,
            },
            (err) => {
              if (err) return reject(err);

              resolve(
                resizeCallback(
                  err,
                  data.ContentType,
                  generateS3Key(key, size),
                  tmpImageName
                )
              );
            }
          );
        } else {
          resolve({
            statusCode: 301,
            headers: {
              Location: `${process.env.CDN_URL}/${generateS3Key(key, size)}`,
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'OPTIONS, GET',
            },
          });
        }
      }
    );
  });
}
