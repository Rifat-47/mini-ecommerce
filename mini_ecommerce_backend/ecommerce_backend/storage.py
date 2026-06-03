import cloudinary
import cloudinary.uploader
import cloudinary.api
import cloudinary.exceptions
from django.core.files.storage import Storage


class CloudinaryMediaStorage(Storage):
    def _open(self, name, mode='rb'):
        raise NotImplementedError("Cloudinary storage does not support direct file reads.")

    def _save(self, name, content):
        public_id = name.replace('\\', '/').rsplit('.', 1)[0]
        response = cloudinary.uploader.upload(
            content,
            public_id=public_id,
            overwrite=True,
            resource_type='auto',
        )
        return response['public_id'] + '.' + response['format']

    def delete(self, name):
        public_id = name.rsplit('.', 1)[0]
        cloudinary.uploader.destroy(public_id)

    def exists(self, name):
        try:
            public_id = name.rsplit('.', 1)[0]
            cloudinary.api.resource(public_id)
            return True
        except cloudinary.exceptions.NotFound:
            return False

    def url(self, name):
        public_id = name.replace('\\', '/').rsplit('.', 1)[0]
        return cloudinary.CloudinaryImage(public_id).build_url(secure=True)
