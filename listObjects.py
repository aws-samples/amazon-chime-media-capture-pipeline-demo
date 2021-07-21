import boto3
import json
import os
from botocore.client import Config
from os import path, makedirs
from botocore.exceptions import ClientError
from boto3.exceptions import S3TransferFailedError

# SOURCE_BUCKET = os.environ['MEDIA_CAPTURE_BUCKET']
SOURCE_BUCKET = 'mediacapturedemo-mediacapturebucketc9e815f7-vufxxv8xbtq2'
SOURCE_PREFIX = 'captures'

def download_s3_folder(s3_folder, local_dir, aws_bucket, debug_en):
    """ Download the contents of a folder directory into a local area """

    success = True

    print('[INFO] Downloading %s from bucket %s...' % (s3_folder, aws_bucket))

    def get_all_s3_objects(s3, **base_kwargs):
        continuation_token = None
        while True:
            list_kwargs = dict(MaxKeys=1000, **base_kwargs)
            if continuation_token:
                list_kwargs['ContinuationToken'] = continuation_token
            response = s3.list_objects_v2(**list_kwargs)
            yield from response.get('Contents', [])
            if not response.get('IsTruncated'):
                break
            continuation_token = response.get('NextContinuationToken')

    s3_client = boto3.client('s3')

    all_s3_objects_gen = get_all_s3_objects(s3_client, Bucket=aws_bucket)

    for obj in all_s3_objects_gen:
        source = obj['Key']
        if source.startswith(s3_folder):
            destination = path.join(local_dir, source)
            if not path.exists(path.dirname(destination)):
                makedirs(path.dirname(destination))
            try:
                s3_client.download_file(aws_bucket, source, destination)
            except (ClientError, S3TransferFailedError) as e:
                print('[ERROR] Could not download file "%s": %s' % (source, e))
                success = False
            if debug_en:
                print('[DEBUG] Downloading: %s --> %s' % (source, destination))

    return success

def handler(meetingId):
    MEETING_ID = meetingId
    # bucket = boto3.resource('s3').Bucket(SOURCE_BUCKET)
    prefix = SOURCE_PREFIX + '/' + MEETING_ID + '/audio'
    # objects = bucket.objects.filter(Prefix=prefix)
    client = boto3.client('s3')

    response = client.list_objects_v2(
        Bucket=SOURCE_BUCKET,
        Delimiter='string',
        MaxKeys=1000,
        Prefix=prefix
    )
    objects = response.get('Contents', [])
    print(objects)
    for object in objects:
        path, filename = os.path.split(object['Key'])
        client.download_file(SOURCE_BUCKET, object['Key'], filename)

    # file_list=[]
    # for object in objects:
    #     path, filename = os.path.split(object.key)
    #     print("filename: " + filename)
    #     print("key: " + object.key)
    #     bucket.download_file(object.key, 'tmp/' + filename)
    #     print("downloaded")
    #     file_list.append(filename)
    # print("Concatenating audio files...")

handler("6a8e93a4-e772-40ea-952c-ce5014250706")