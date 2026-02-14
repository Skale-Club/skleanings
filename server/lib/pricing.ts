
import {
    type Service,
    type ServiceOption,
    type ServiceFrequency,
    type PriceBreakdown,
    type BookingItemOption,
    type BookingItemFrequency,
    type AreaSizePreset,
    type CartItemData
} from "@shared/schema";

// Helper function to calculate price for a cart item based on pricing type
export async function calculateCartItemPrice(
    service: Service,
    cartItem: CartItemData,
    options: ServiceOption[],
    frequencies: ServiceFrequency[]
): Promise<{
    price: number;
    breakdown: PriceBreakdown;
    selectedOptions?: BookingItemOption[];
    selectedFrequency?: BookingItemFrequency;
    areaSize?: string;
    areaValue?: number;
}> {
    const pricingType = service.pricingType || 'fixed_item';
    const quantity = cartItem.quantity || 1;

    switch (pricingType) {
        case 'fixed_item': {
            const unitPrice = Number(service.price);
            const finalPrice = unitPrice * quantity;
            return {
                price: finalPrice,
                breakdown: {
                    subtotal: finalPrice,
                    finalPrice: finalPrice,
                }
            };
        }

        case 'area_based': {
            const areaSizes = (service.areaSizes as AreaSizePreset[]) || [];
            let areaPrice = 0;
            let areaSize = cartItem.areaSize || 'Custom';
            let areaValue = cartItem.areaValue;

            if (cartItem.areaSize && cartItem.areaSize !== 'custom') {
                // Use preset price
                const preset = areaSizes.find(s => s.name === cartItem.areaSize);
                if (preset) {
                    areaPrice = preset.price;
                    areaValue = preset.sqft || undefined;
                }
            } else if (cartItem.areaValue) {
                // Custom area - calculate based on pricePerUnit
                const pricePerUnit = Number(service.pricePerUnit || 0);
                areaPrice = cartItem.areaValue * pricePerUnit;
                areaSize = `Custom: ${cartItem.areaValue} sqft`;
            }

            // Apply minimum price
            const minimumPrice = Number(service.minimumPrice || 0);
            const finalPrice = Math.max(areaPrice, minimumPrice) * quantity;

            return {
                price: finalPrice,
                areaSize,
                areaValue,
                breakdown: {
                    areaPrice,
                    subtotal: areaPrice * quantity,
                    finalPrice,
                }
            };
        }

        case 'base_plus_addons': {
            const basePrice = Number(service.basePrice || service.price);
            let optionsTotal = 0;
            const selectedOptions: BookingItemOption[] = [];

            // Calculate options total
            if (cartItem.selectedOptions && cartItem.selectedOptions.length > 0) {
                for (const selectedOpt of cartItem.selectedOptions) {
                    const option = options.find(o => o.id === selectedOpt.optionId);
                    if (option) {
                        const optPrice = Number(option.price) * selectedOpt.quantity;
                        optionsTotal += optPrice;
                        selectedOptions.push({
                            id: option.id,
                            name: option.name,
                            price: Number(option.price),
                            quantity: selectedOpt.quantity,
                        });
                    }
                }
            }

            let subtotal = (basePrice + optionsTotal) * quantity;
            let discountPercent = 0;
            let discountAmount = 0;
            let selectedFrequency: BookingItemFrequency | undefined;

            // Apply frequency discount
            if (cartItem.selectedFrequencyId) {
                const frequency = frequencies.find(f => f.id === cartItem.selectedFrequencyId);
                if (frequency) {
                    discountPercent = Number(frequency.discountPercent || 0);
                    discountAmount = subtotal * (discountPercent / 100);
                    selectedFrequency = {
                        id: frequency.id,
                        name: frequency.name,
                        discountPercent,
                    };
                }
            }

            const finalPrice = subtotal - discountAmount;

            return {
                price: finalPrice,
                selectedOptions: selectedOptions.length > 0 ? selectedOptions : undefined,
                selectedFrequency,
                breakdown: {
                    basePrice,
                    optionsTotal,
                    subtotal,
                    discountPercent: discountPercent > 0 ? discountPercent : undefined,
                    discountAmount: discountAmount > 0 ? discountAmount : undefined,
                    finalPrice,
                }
            };
        }

        case 'custom_quote': {
            // Custom quote uses minimum price as the base
            const minimumPrice = Number(service.minimumPrice || service.price);
            return {
                price: minimumPrice * quantity,
                breakdown: {
                    subtotal: minimumPrice * quantity,
                    finalPrice: minimumPrice * quantity,
                }
            };
        }

        default:
            // Fallback to fixed price
            const fallbackPrice = Number(service.price) * quantity;
            return {
                price: fallbackPrice,
                breakdown: {
                    subtotal: fallbackPrice,
                    finalPrice: fallbackPrice,
                }
            };
    }
}
