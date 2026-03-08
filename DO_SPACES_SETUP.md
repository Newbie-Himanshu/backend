# Digital Ocean Spaces Integration Guide

This document explains how to set up and use Digital Ocean Spaces for storing product and product variant images in your Vridhira marketplace.

## What is Digital Ocean Spaces?

Digital Ocean Spaces is an object storage service that is S3-compatible. This means it uses the same API as AWS S3, making it a cost-effective alternative for storing files in the cloud. Your project is configured to use Digital Ocean Spaces as the primary file storage backend.

## Setup Instructions

### Step 1: Create a Digital Ocean Space

1. Log in to your Digital Ocean account at https://cloud.digitalocean.com
2. Navigate to **Spaces** (with CDN) in the left sidebar
3. Click **Create a Space**
4. Choose:
   - **Space name**: Give it a unique name (e.g., `vridhira-products`)
   - **Region**: Choose the region closest to your users (e.g., `nyc3`, `sfo3`, `sgp1`)
   - **CDN**: Enable if you want faster content delivery (optional but recommended)
5. Click **Create Space**

### Step 2: Generate Access Keys

1. In Digital Ocean, go to **Account** (top-right menu) → **API**
2. Scroll to **Spaces Keys** section
3. Click **Generate New Key**
4. Copy both:
   - **Access Key** (Access Key ID)
   - **Secret Key** (Secret Access Key)
5. Keep these safe - you won't be able to see the secret key again!

### Step 3: Configure Environment Variables

Update your `.env` file with the credentials:

```env
# Digital Ocean Spaces Configuration
DO_SPACES_ACCESS_KEY_ID=your-access-key-here
DO_SPACES_SECRET_ACCESS_KEY=your-secret-key-here
DO_SPACES_SPACE_NAME=vridhira-products
DO_SPACES_REGION=nyc3
DO_SPACES_ENDPOINT=https://vridhira-products.nyc3.digitaloceanspaces.com
```

**Where to find each value:**

| Variable | Where to find it |
|----------|------------------|
| `DO_SPACES_ACCESS_KEY_ID` | Generated in Step 2 (Access Key) |
| `DO_SPACES_SECRET_ACCESS_KEY` | Generated in Step 2 (Secret Key) |
| `DO_SPACES_SPACE_NAME` | The name you gave your Space in Step 1 |
| `DO_SPACES_REGION` | The region you selected (e.g., nyc3, sfo3) |
| `DO_SPACES_ENDPOINT` | `https://{space-name}.{region}.digitaloceanspaces.com` |

### Step 4: Restart the Server

After configuring the environment variables, restart your Medusa server:

```bash
yarn dev
# or
npm run dev
```

The file module will automatically initialize and connect to Digital Ocean Spaces.

## How It Works

Once configured, MedusaJS will automatically use Digital Ocean Spaces for:

1. **Product Images**: When uploading product thumbnails and images through the admin dashboard
2. **Product Variant Images**: Images specific to product variants (colors, sizes, etc.)
3. **Other Files**: Any file uploads in the admin interface

### Request Flow

```
Admin Upload File
    ↓
MedusaJS File API
    ↓
S3 Provider (AWS SDK configured for Digital Ocean)
    ↓
Digital Ocean Spaces API
    ↓
File stored in your Space
    ↓
File URL returned (https://{space-name}.{region}.digitaloceanspaces.com/path/to/file)
```

## Using Digital Ocean Spaces with Product Images

### Admin Dashboard

1. Go to **Products** → Create/Edit a product
2. In the product details, find the **Image** section
3. Click **Upload Image**
4. Select your image file
5. The image is automatically uploaded to Digital Ocean Spaces
6. A CDN URL is generated and saved to the database

### Product Variants

The `medusa-variant-images` plugin stores variant images in product metadata. These can also be uploaded through the admin UI:

1. In product details, find **Variants section**
2. Click on a variant to edit
3. Upload variant-specific images
4. Images are stored in Digital Ocean Spaces and linked in the database

## File Organization in Digital Ocean Spaces

Files are organized in a logical structure within your Space:

```
your-space-name/
├── products/
│   ├── product-id-1/
│   │   ├── image1.jpg
│   │   └── image2.jpg
│   └── product-id-2/
│       └── image1.png
└── variants/
    ├── variant-id-1/
    │   └── image.jpg
    └── variant-id-2/
        └── image.jpg
```

## Testing the Integration

### Via API

Upload a product image using the Medusa Admin API:

```bash
# Get your admin API token first
# Then upload a file
curl -X POST http://localhost:9000/admin/uploads \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "files=@/path/to/image.jpg"
```

### Via Admin Dashboard

1. Navigate to **Products** → **Create Product**
2. Upload a product image
3. Verify the image is stored in Digital Ocean Spaces by:
   - Checking your Space in the Digital Ocean dashboard
   - Verifying the image is publicly accessible via the CDN URL

## Troubleshooting

### Issue: "Invalid credentials" or "403 Forbidden"

**Causes:**
- Access Key ID or Secret Key is incorrect
- Access Key doesn't have permissions

**Solution:**
1. Re-check your credentials in the Digital Ocean API settings
2. Ensure the key hasn't been revoked
3. Generate a new key pair if needed

### Issue: Files not appearing in Digital Ocean Space

**Causes:**
- Environment variables not set
- Server not restarted after setting variables
- File module not initialized

**Solution:**
1. Verify all `DO_SPACES_*` variables are set: `echo $DO_SPACES_ACCESS_KEY_ID`
2. Check server logs for initialization messages
3. Restart the server: `yarn dev`

### Issue: 404 errors when accessing uploaded files

**Causes:**
- `DO_SPACES_ENDPOINT` is incorrect
- File permissions are not public
- Files are in the wrong directory

**Solution:**
1. Verify the endpoint format: `https://{space-name}.{region}.digitaloceanspaces.com`
2. Make sure your Space allows public read access (configure in Digital Ocean)
3. Check that files are being stored with public ACL

### Issue: "403 Forbidden" when accessing files

**Solution:**
In Digital Ocean:
1. Go to your Space settings
2. Enable **CORS** if needed for cross-origin requests
3. Set appropriate access policies

## Security Best Practices

1. **Rotate Keys Regularly**: Generate new key pairs periodically and revoke old ones
2. **Limit Permissions**: Consider creating a separate Space with limited permissions just for product images
3. **HTTPS Only**: Always use HTTPS URLs (provided by default with DO_SPACES_ENDPOINT)
4. **Environment Variables**: Never commit `.env` files with credentials to version control
5. **Backup**: Regularly backup your Space or enable versioning in Digital Ocean

## Monitoring and Optimization

### Bandwidth Usage

Monitor your Digital Ocean Spaces bandwidth usage in the Dashboard:
1. Go to **Spaces** → Your Space → **Insights** tab
2. Check storage used and bandwidth consumed
3. Consider enabling CDN for frequently accessed images

### Performance Tips

1. **Use CDN**: Enable CDN when creating the Space for faster delivery globally
2. **Compress Images**: Compress product images before uploading to reduce storage costs
3. **Cache Headers**: CDN automatically caches images with appropriate headers

## Related Documentation

- [Digital Ocean Spaces Documentation](https://docs.digitalocean.com/products/spaces/)
- [MedusaJS File Module](https://docs.medusajs.com/resources/infrastructure-modules/file/s3)
- [AWS SDK S3 Documentation](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/s3.html)

## Environment Variables Reference

```env
# Access credentials (from Digital Ocean API page)
DO_SPACES_ACCESS_KEY_ID=your-access-key
DO_SPACES_SECRET_ACCESS_KEY=your-secret-key

# Space configuration
DO_SPACES_SPACE_NAME=your-space-name
DO_SPACES_REGION=nyc3
DO_SPACES_ENDPOINT=https://your-space-name.nyc3.digitaloceanspaces.com
```

---

**Last Updated**: March 2026
**Integration**: MedusaJS 2.13.1 with @medusajs/medusa-file-s3
