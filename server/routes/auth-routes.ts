import { Router } from "express";
import { storage } from "../storage";

const router = Router();

router.post("/register", async (req, res) => {
    // ... validation ...
    const newUser = await storage.createUser({ ...req.body, isAdmin: false });
    res.status(201).json(newUser);
});

export default router;
