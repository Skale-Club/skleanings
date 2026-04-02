import { Router } from "express";
import { storage } from "../storage";
import { getAuthMe } from "../lib/auth";

const router = Router();

router.get("/auth/me", getAuthMe);

router.post("/register", async (req, res) => {
    // ... validation ...
    const newUser = await storage.createUser({ ...req.body, isAdmin: false });
    res.status(201).json(newUser);
});

export default router;
