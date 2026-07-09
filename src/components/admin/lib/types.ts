import type { Database } from "@/lib/database.types";

export type Folder = Database["public"]["Tables"]["folders"]["Row"];
export type AppointmentSlot = Database["public"]["Tables"]["appointment_slots"]["Row"];
export type AppointmentSlotInsert = Database["public"]["Tables"]["appointment_slots"]["Insert"];
export type AppointmentSlotUpdate = Database["public"]["Tables"]["appointment_slots"]["Update"];
export type AppointmentBooking = Database["public"]["Tables"]["appointment_bookings"]["Row"];
export type AppointmentBookingUpdate = Database["public"]["Tables"]["appointment_bookings"]["Update"];
export type Lead = Database["public"]["Tables"]["leads"]["Row"] & {
  appointment_start?: string | null;
  appointment_status?: AppointmentBooking["status"] | null;
  appointment_booking_id?: string | null;
};
export type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];
export type LeadMailEvent = Database["public"]["Tables"]["lead_mail_events"]["Row"];
export type AuthState = "loading" | "signed-out" | "authorized" | "denied";

export type AdminView = { name: "dashboard" } | { name: "leads"; folderId: string } | { name: "appointments" };
