import { Router } from "express";
import { requireAdmin } from "../lib/auth";

const router = Router();

// GET /api/contacts?search=&limit= — list with aggregated stats
router.get("/", requireAdmin, async (req, res) => {
  const storage = res.locals.storage!;
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const contacts = await storage.listContactsWithStats(search, limit);
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// GET /api/contacts/:id — single contact
router.get("/:id", requireAdmin, async (req, res) => {
  const storage = res.locals.storage!;
  try {
    const contact = await storage.getContact(Number(req.params.id));
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    res.json(contact);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// GET /api/contacts/:id/bookings — booking history for contact
router.get("/:id/bookings", requireAdmin, async (req, res) => {
  const storage = res.locals.storage!;
  try {
    const bookingsList = await storage.getContactBookings(Number(req.params.id));
    res.json(bookingsList);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

// PUT /api/contacts/:id — update contact (notes, name, email, phone, address)
router.put("/:id", requireAdmin, async (req, res) => {
  const storage = res.locals.storage!;
  try {
    const { name, email, phone, address, notes } = req.body;
    const updated = await storage.updateContact(Number(req.params.id), {
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(address !== undefined && { address }),
      ...(notes !== undefined && { notes }),
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

export default router;
