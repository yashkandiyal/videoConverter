import { Router } from "express";
import {
  ALLOWED_RESOLUTIONS,
  getVideoJobStatusByRes,
} from "../services/video.service.js";

export const jobRouter = Router();

jobRouter.get("/:resolution/:jobId", async (req, res, next) => {
  try {
    const resolution = Number(req.params.resolution);
    const { jobId } = req.params;

    if (!ALLOWED_RESOLUTIONS.includes(resolution as any)) {
      return res.status(400).json({
        error: `Resolution must be one of ${ALLOWED_RESOLUTIONS.join(", ")}`,
      });
    }

    const status = await getVideoJobStatusByRes(resolution, jobId);
    if (!status) return res.status(404).json({ error: "Job not found" });

    res.json(status);
  } catch (err) {
    next(err);
  }
});

jobRouter.get("/any/:jobId", async (req, res, next) => {
  try {
    const { jobId } = req.params;

    for (const reso of ALLOWED_RESOLUTIONS) {
      const status = await getVideoJobStatusByRes(reso, jobId);
      if (status) return res.json(status);
    }

    res.status(404).json({ error: "Job not found in any queue" });
  } catch (err) {
    next(err);
  }
});
