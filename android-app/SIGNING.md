# Android release signing

The CI workflow (`.github/workflows/android-release.yml`) builds a signed
`.aab` (Android App Bundle) entirely on GitHub's servers — no Android device
or local Android Studio install is required.

To enable signed builds, add these four **Repository secrets** under
`Settings > Secrets and variables > Actions` on GitHub:

| Secret name                 | Value                                              |
| ---------------------------- | --------------------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`    | base64-encoded contents of the upload keystore file |
| `ANDROID_KEYSTORE_PASSWORD`  | keystore password                                    |
| `ANDROID_KEY_ALIAS`          | key alias inside the keystore                        |
| `ANDROID_KEY_PASSWORD`       | key password (same as keystore password, for PKCS12) |

The keystore itself is never committed to git (see `.gitignore`). Whoever
holds it must keep the file + passwords somewhere safe and durable — losing
it means losing the ability to publish updates to this app under the same
Play Store listing (Play App Signing can recover from this, but it requires
a support request to Google and can take days).

To generate a new keystore locally (only needed if the original one is lost,
since a new install of this repo intentionally does not include the existing
one):

```bash
keytool -genkeypair -v \
  -keystore rrpoker-upload.keystore \
  -alias rrpoker-upload \
  -keyalg RSA -keysize 2048 -validity 10950 \
  -storepass '<choose a password>' -keypass '<same password>' \
  -dname "CN=RRPoker, OU=RRPoker, O=RRPoker, L=Tokyo, ST=Tokyo, C=JP"

base64 -w0 rrpoker-upload.keystore > rrpoker-upload.keystore.base64
```

Then paste the `.base64` file contents into the `ANDROID_KEYSTORE_BASE64`
secret.
