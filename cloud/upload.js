import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "./Cloudinary.js";
import path from "path";

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const name = path.parse(file.originalname).name.replace(/\s+/g, "_");
    const publicId = `${Date.now()}-${name}`;

    // 🟢 Handle video uploads (MP4)
    if (file.mimetype.startsWith("video/")) {
      return {
        folder: "nymara/videos",
        resource_type: "video", // ✅ must specify for MP4 uploads
        allowed_formats: ["mp4"],
        public_id: publicId,
      };
    }

    // 🟢 Handle 3D model uploads (.glb / .usdz)
    if (
      file.originalname.endsWith(".glb") ||
      file.originalname.endsWith(".usdz")
    ) {
      return {
        folder: "nymara/models",
        resource_type: "raw", // ✅ for non-image binary files
        allowed_formats: ["glb", "usdz"],
        public_id: publicId,
      };
    }

    // 🟢 Default: image uploads
    return {
      folder: "nymara",
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
    };
  },
});

const upload = multer({ storage });

export default upload;
