import React, { createContext, useContext, useState } from "react";
import type { Service } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { trackAddToCart, trackRemoveFromCart } from "@/lib/analytics";

// Selected option for cart item
interface SelectedOption {
  optionId: number;
  name: string;
  price: number;
  quantity: number;
}

// Selected frequency for cart item
interface SelectedFrequency {
  id: number;
  name: string;
  discountPercent: number;
}

// Extended cart item with pricing details
export interface CartItem extends Service {
  quantity: number;
  // Pricing-specific fields
  calculatedPrice: number; // Final calculated price for this item
  areaSize?: string; // For area_based: preset name or "custom"
  areaValue?: number; // For area_based: custom sqft value
  selectedOptions?: SelectedOption[]; // For base_plus_addons
  selectedFrequency?: SelectedFrequency | null; // For base_plus_addons
  customerNotes?: string; // For custom_quote
  priceBreakdown?: {
    basePrice?: number;
    areaPrice?: number;
    optionsTotal?: number;
    subtotal: number;
    discountPercent?: number;
    discountAmount?: number;
    finalPrice: number;
  };
}

// Data needed to add an item to cart
export interface AddToCartData {
  service: Service;
  quantity?: number;
  calculatedPrice: number;
  areaSize?: string;
  areaValue?: number;
  selectedOptions?: SelectedOption[];
  selectedFrequency?: SelectedFrequency | null;
  customerNotes?: string;
  priceBreakdown?: CartItem['priceBreakdown'];
}

interface CartContextType {
  items: CartItem[];
  addItem: (data: AddToCartData) => void;
  addItemSimple: (service: Service) => void; // Legacy method for fixed_item
  removeItem: (serviceId: number) => void;
  updateQuantity: (serviceId: number, quantity: number) => void;
  updateItem: (serviceId: number, data: Partial<AddToCartData>) => void;
  clearCart: () => void;
  totalPrice: number;
  totalDuration: number;
  getCartItemsForBooking: () => any[]; // Get cart items formatted for booking API
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const { toast } = useToast();

  // Full add item with pricing details
  const addItem = (data: AddToCartData) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === data.service.id);
      if (existing) {
        // Update existing item
        return prev.map(item =>
          item.id === data.service.id
            ? {
                ...item,
                ...data.service,
                quantity: data.quantity || 1,
                calculatedPrice: data.calculatedPrice,
                areaSize: data.areaSize,
                areaValue: data.areaValue,
                selectedOptions: data.selectedOptions,
                selectedFrequency: data.selectedFrequency,
                customerNotes: data.customerNotes,
                priceBreakdown: data.priceBreakdown,
              }
            : item
        );
      }

      trackAddToCart({
        id: data.service.id,
        name: data.service.name,
        price: data.calculatedPrice,
      });

      return [
        ...prev,
        {
          ...data.service,
          quantity: data.quantity || 1,
          calculatedPrice: data.calculatedPrice,
          areaSize: data.areaSize,
          areaValue: data.areaValue,
          selectedOptions: data.selectedOptions,
          selectedFrequency: data.selectedFrequency,
          customerNotes: data.customerNotes,
          priceBreakdown: data.priceBreakdown,
        },
      ];
    });
  };

  // Simple add for fixed_item services (legacy support)
  const addItemSimple = (service: Service) => {
    addItem({
      service,
      quantity: 1,
      calculatedPrice: Number(service.price),
      priceBreakdown: {
        subtotal: Number(service.price),
        finalPrice: Number(service.price),
      },
    });
  };

  const removeItem = (serviceId: number) => {
    const item = items.find((i) => i.id === serviceId);
    if (item) {
      trackRemoveFromCart({
        id: item.id,
        name: item.name,
        price: item.calculatedPrice,
      });
    }
    setItems((prev) => prev.filter((i) => i.id !== serviceId));
  };

  const updateQuantity = (serviceId: number, quantity: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== serviceId) return item;

        // Recalculate price based on quantity
        const unitPrice = item.calculatedPrice / item.quantity;
        const newCalculatedPrice = unitPrice * quantity;

        return {
          ...item,
          quantity,
          calculatedPrice: newCalculatedPrice,
          priceBreakdown: item.priceBreakdown
            ? {
                ...item.priceBreakdown,
                subtotal: (item.priceBreakdown.subtotal / item.quantity) * quantity,
                finalPrice: newCalculatedPrice,
              }
            : undefined,
        };
      })
    );
  };

  const updateItem = (serviceId: number, data: Partial<AddToCartData>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== serviceId) return item;
        return {
          ...item,
          quantity: data.quantity ?? item.quantity,
          calculatedPrice: data.calculatedPrice ?? item.calculatedPrice,
          areaSize: data.areaSize ?? item.areaSize,
          areaValue: data.areaValue ?? item.areaValue,
          selectedOptions: data.selectedOptions ?? item.selectedOptions,
          selectedFrequency: data.selectedFrequency ?? item.selectedFrequency,
          customerNotes: data.customerNotes ?? item.customerNotes,
          priceBreakdown: data.priceBreakdown ?? item.priceBreakdown,
        };
      })
    );
  };

  const clearCart = () => setItems([]);

  // Calculate total price from calculated prices
  const totalPrice = items.reduce(
    (sum, item) => sum + item.calculatedPrice,
    0
  );

  const totalDuration = items.reduce(
    (sum, item) => sum + item.durationMinutes * item.quantity,
    0
  );

  // Format cart items for booking API
  const getCartItemsForBooking = () => {
    return items.map((item) => ({
      serviceId: item.id,
      quantity: item.quantity,
      areaSize: item.areaSize,
      areaValue: item.areaValue,
      selectedOptions: item.selectedOptions?.map((opt) => ({
        optionId: opt.optionId,
        quantity: opt.quantity,
      })),
      selectedFrequencyId: item.selectedFrequency?.id,
      customerNotes: item.customerNotes,
    }));
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        addItemSimple,
        removeItem,
        updateQuantity,
        updateItem,
        clearCart,
        totalPrice,
        totalDuration,
        getCartItemsForBooking,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
