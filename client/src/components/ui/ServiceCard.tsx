import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Service } from "@shared/schema";
import { useCart, type AddToCartData } from "@/context/CartContext";
import { Clock, Check, ImageIcon, Plus, Minus, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { clsx } from "clsx";
import { AreaSizeSelector, OptionsSelector, FrequencySelector, CustomQuoteForm } from "@/components/pricing";
import { Button } from "@/components/ui/button";

interface ServiceOption {
  id: number;
  name: string;
  price: string;
  maxQuantity?: number | null;
}

interface ServiceFrequency {
  id: number;
  name: string;
  discountPercent: string;
}

interface AreaSizePreset {
  name: string;
  sqft: number | null;
  price: number;
}

interface ServiceCardProps {
  service: Service;
}

export function ServiceCard({ service }: ServiceCardProps) {
  const { addItem, addItemSimple, items, removeItem, updateQuantity } = useCart();

  const pricingType = (service as any).pricingType || 'fixed_item';
  const cartItem = items.find((item) => item.id === service.id);
  const isInCart = !!cartItem;
  const quantity = cartItem?.quantity || 0;

  // State for complex pricing types
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedAreaSize, setSelectedAreaSize] = useState<string>('');
  const [selectedAreaValue, setSelectedAreaValue] = useState<number | undefined>();
  const [areaPrice, setAreaPrice] = useState<number>(0);
  const [selectedOptions, setSelectedOptions] = useState<Array<{ optionId: number; name: string; price: number; quantity: number }>>([]);
  const [optionsTotal, setOptionsTotal] = useState<number>(0);
  const [selectedFrequency, setSelectedFrequency] = useState<{ id: number; name: string; discountPercent: number } | null>(null);
  const [customerNotes, setCustomerNotes] = useState<string>('');
  const [calculatedPrice, setCalculatedPrice] = useState<number>(Number(service.price));

  // Fetch options and frequencies for base_plus_addons
  const { data: serviceOptions = [] } = useQuery<ServiceOption[]>({
    queryKey: ['/api/services', service.id, 'options'],
    queryFn: async () => {
      const res = await fetch(`/api/services/${service.id}/options`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: pricingType === 'base_plus_addons',
    staleTime: 60000,
  });

  const { data: serviceFrequencies = [] } = useQuery<ServiceFrequency[]>({
    queryKey: ['/api/services', service.id, 'frequencies'],
    queryFn: async () => {
      const res = await fetch(`/api/services/${service.id}/frequencies`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: pricingType === 'base_plus_addons',
    staleTime: 60000,
  });

  const { data: suggestedAddons = [], isLoading: addonsLoading, isError } = useQuery<Service[]>({
    queryKey: ['/api/services', service.id, 'addons'],
    queryFn: async () => {
      const res = await fetch(`/api/services/${service.id}/addons`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: isInCart && pricingType === 'fixed_item',
    staleTime: 60000,
  });

  // Calculate price based on pricing type
  useEffect(() => {
    let price = 0;

    switch (pricingType) {
      case 'fixed_item':
        price = Number(service.price);
        break;

      case 'area_based':
        price = areaPrice || Number((service as any).minimumPrice || service.price);
        break;

      case 'base_plus_addons':
        const basePrice = Number((service as any).basePrice || service.price);
        let subtotal = basePrice + optionsTotal;
        if (selectedFrequency && selectedFrequency.discountPercent > 0) {
          subtotal = subtotal * (1 - selectedFrequency.discountPercent / 100);
        }
        price = subtotal;
        break;

      case 'custom_quote':
        price = Number((service as any).minimumPrice || service.price);
        break;

      default:
        price = Number(service.price);
    }

    setCalculatedPrice(price);
  }, [service, pricingType, areaPrice, optionsTotal, selectedFrequency]);

  // Handle add to cart
  const handleAddToCart = () => {
    if (pricingType === 'fixed_item') {
      addItemSimple(service);
      return;
    }

    // Build cart data based on pricing type
    const cartData: AddToCartData = {
      service,
      quantity: 1,
      calculatedPrice,
    };

    if (pricingType === 'area_based') {
      cartData.areaSize = selectedAreaSize;
      cartData.areaValue = selectedAreaValue;
      cartData.priceBreakdown = {
        areaPrice,
        subtotal: areaPrice,
        finalPrice: calculatedPrice,
      };
    } else if (pricingType === 'base_plus_addons') {
      const basePrice = Number((service as any).basePrice || service.price);
      cartData.selectedOptions = selectedOptions;
      cartData.selectedFrequency = selectedFrequency;
      cartData.priceBreakdown = {
        basePrice,
        optionsTotal,
        subtotal: basePrice + optionsTotal,
        discountPercent: selectedFrequency?.discountPercent,
        discountAmount: selectedFrequency ? (basePrice + optionsTotal) * (selectedFrequency.discountPercent / 100) : 0,
        finalPrice: calculatedPrice,
      };
    } else if (pricingType === 'custom_quote') {
      cartData.customerNotes = customerNotes;
      cartData.priceBreakdown = {
        subtotal: calculatedPrice,
        finalPrice: calculatedPrice,
      };
    }

    addItem(cartData);
    setIsExpanded(false);
  };

  // Get display price
  const getDisplayPrice = () => {
    if (pricingType === 'area_based') {
      const areaSizes = (service as any).areaSizes as AreaSizePreset[] | undefined;
      if (areaSizes && areaSizes.length > 0) {
        const minPrice = Math.min(...areaSizes.map(s => s.price));
        const minimum = Number((service as any).minimumPrice || 0);
        const displayPrice = Math.max(minPrice, minimum);
        return `From $${displayPrice.toFixed(2)}`;
      }
    } else if (pricingType === 'base_plus_addons') {
      return `From $${Number((service as any).basePrice || service.price).toFixed(2)}`;
    } else if (pricingType === 'custom_quote') {
      return `From $${Number((service as any).minimumPrice || service.price).toFixed(2)}`;
    }
    return `$${Number(service.price).toFixed(2)}`;
  };

  // Check if can add to cart (validation)
  const canAddToCart = () => {
    if (pricingType === 'fixed_item') return true;
    if (pricingType === 'area_based') {
      if (!selectedAreaSize) return false;
      if (selectedAreaSize === 'custom') {
        return typeof selectedAreaValue === 'number' && selectedAreaValue > 0;
      }
      return true;
    }
    if (pricingType === 'base_plus_addons') return true; // Base price is enough
    if (pricingType === 'custom_quote') return true; // Notes are optional
    return true;
  };

  const needsConfiguration = pricingType !== 'fixed_item';

  return (
    <div className="group bg-light-gray rounded-lg overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full">
      {/* 4:3 Aspect Ratio Image */}
      <div
        className="relative w-full pt-[75%] bg-slate-100 overflow-hidden cursor-pointer"
        onClick={() => {
          if (!isInCart && !needsConfiguration) {
            addItemSimple(service);
          } else if (!isInCart && needsConfiguration) {
            setIsExpanded(true);
          }
        }}
      >
        <div className="absolute top-2 right-2 z-10">
          <div className="bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-slate-600 text-xs font-bold flex items-center shadow-sm border border-slate-100">
            <Clock className="w-3 h-3 mr-1" />
            {service.durationMinutes} mins
          </div>
        </div>

        {/* Pricing Type Badge */}
        {pricingType !== 'fixed_item' && (
          <div className="absolute top-2 left-2 z-10">
            <div className="bg-amber-500 text-white px-2 py-1 rounded-md text-xs font-bold">
              {pricingType === 'area_based' && 'By Area'}
              {pricingType === 'base_plus_addons' && 'Customizable'}
              {pricingType === 'custom_quote' && 'Custom Quote'}
            </div>
          </div>
        )}

        {service.imageUrl ? (
          <img
            src={service.imageUrl}
            alt={service.name}
            className="absolute top-0 left-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.01] select-none"
            draggable={false}
          />
        ) : (
          <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center text-slate-300">
            <ImageIcon className="w-12 h-12" />
          </div>
        )}
      </div>

      <div className="p-6 flex flex-col flex-grow">
        <h3
          className="text-xl font-bold text-slate-900 group-hover:text-primary transition-colors mb-1 cursor-pointer"
          onClick={() => {
            if (!isInCart && !needsConfiguration) {
              addItemSimple(service);
            } else if (!isInCart && needsConfiguration) {
              setIsExpanded(true);
            }
          }}
        >
          {service.name}
        </h3>

        <p className="text-slate-500 text-sm mb-4 flex-grow">
          {service.description || "Professional cleaning service tailored to your needs."}
        </p>

        <div className="flex flex-col">
          <span className="text-lg font-bold text-slate-900 mb-4">
            {isInCart ? `$${calculatedPrice.toFixed(2)}` : getDisplayPrice()}
          </span>
        </div>

        {/* Expanded Configuration Section */}
        {!isInCart && needsConfiguration && isExpanded && (
          <div className="mb-4 p-4 bg-slate-50 rounded-lg space-y-4">
            {pricingType === 'area_based' && (
              <AreaSizeSelector
                areaSizes={(service as any).areaSizes || []}
                pricePerUnit={(service as any).pricePerUnit}
                minimumPrice={(service as any).minimumPrice}
                selectedSize={selectedAreaSize}
                onSelect={({ areaSize, areaValue, price }) => {
                  setSelectedAreaSize(areaSize);
                  setSelectedAreaValue(areaValue);
                  setAreaPrice(price);
                }}
              />
            )}

            {pricingType === 'base_plus_addons' && (
              <>
                <div className="text-sm">
                  <span className="font-medium">Base Service:</span>
                  <span className="ml-2 text-primary font-bold">
                    ${Number((service as any).basePrice || service.price).toFixed(2)}
                  </span>
                </div>

                <OptionsSelector
                  options={serviceOptions}
                  onChange={(selected, total) => {
                    setSelectedOptions(
                      selected.map(s => {
                        const opt = serviceOptions.find(o => o.id === s.optionId);
                        return {
                          optionId: s.optionId,
                          name: opt?.name || '',
                          price: Number(opt?.price || 0),
                          quantity: s.quantity,
                        };
                      })
                    );
                    setOptionsTotal(total);
                  }}
                />

                <FrequencySelector
                  frequencies={serviceFrequencies}
                  selectedId={selectedFrequency?.id}
                  onSelect={(freq, discount) => {
                    setSelectedFrequency(freq ? { id: freq.id, name: freq.name, discountPercent: discount } : null);
                  }}
                />

                {/* Price Summary */}
                <div className="pt-3 border-t border-slate-200 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Base:</span>
                    <span>${Number((service as any).basePrice || service.price).toFixed(2)}</span>
                  </div>
                  {optionsTotal > 0 && (
                    <div className="flex justify-between">
                      <span>Add-ons:</span>
                      <span>+${optionsTotal.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedFrequency && selectedFrequency.discountPercent > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount ({selectedFrequency.discountPercent}%):</span>
                      <span>-${((Number((service as any).basePrice || service.price) + optionsTotal) * (selectedFrequency.discountPercent / 100)).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-2 border-t">
                    <span>Total:</span>
                    <span>${calculatedPrice.toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}

            {pricingType === 'custom_quote' && (
              <CustomQuoteForm
                minimumPrice={(service as any).minimumPrice}
                onChange={setCustomerNotes}
              />
            )}
          </div>
        )}

        <div className="flex gap-2">
          {!isInCart ? (
            needsConfiguration ? (
              <div className="flex-grow flex gap-2">
                <Button
                  onClick={() => setIsExpanded(!isExpanded)}
                  variant="outline"
                  className="flex-grow"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-4 h-4 mr-2" /> Hide Options
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-2" /> Configure
                    </>
                  )}
                </Button>
                {isExpanded && (
                  <Button
                    onClick={handleAddToCart}
                    disabled={!canAddToCart()}
                    className="flex-grow bg-blue-600 hover:bg-blue-700"
                  >
                    Add ${calculatedPrice.toFixed(2)}
                  </Button>
                )}
              </div>
            ) : (
              <button
                onClick={() => addItemSimple(service)}
                className="flex-grow py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
              >
                Add to Booking
              </button>
            )
          ) : (
            <>
              <button
                onClick={() => removeItem(service.id)}
                className="flex-grow py-3 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 bg-green-600 text-white hover:bg-green-700"
              >
                <Check className="w-4 h-4" /> Added
              </button>

              {pricingType === 'fixed_item' && (
                <div className="flex items-center bg-slate-200 rounded-xl p-0.5 gap-0.5">
                  <button
                    onClick={() => {
                      if (quantity > 1) {
                        updateQuantity(service.id, quantity - 1);
                      } else {
                        removeItem(service.id);
                      }
                    }}
                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 text-center font-bold text-slate-900 text-sm">
                    {quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(service.id, quantity + 1)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Suggested Add-ons for fixed_item */}
        {isInCart && pricingType === 'fixed_item' && suggestedAddons.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-slate-700">Suggested Add-ons</span>
            </div>
            <div className="flex overflow-x-auto gap-3 pb-2 snap-x snap-mandatory scroll-smooth no-scrollbar">
              {suggestedAddons.map(addon => {
                const addonItem = items.find(i => i.id === addon.id);
                const isAddonInCart = !!addonItem;
                const addonQty = addonItem?.quantity || 0;

                return (
                  <div key={addon.id} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg min-w-[280px] snap-start">
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-15 shrink-0 rounded-md overflow-hidden bg-slate-200">
                        {addon.imageUrl ? (
                          <img
                            src={addon.imageUrl}
                            alt={addon.name}
                            className="w-full h-full object-cover select-none"
                            draggable={false}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800 mb-0.5">{addon.name}</p>
                        <p className="text-sm font-bold text-slate-900">${addon.price}</p>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      {isAddonInCart ? (
                        <div className="flex items-center bg-white rounded-lg p-0.5 gap-1 border border-slate-200 shadow-sm">
                          <button
                            onClick={() => {
                              if (addonQty > 1) {
                                updateQuantity(addon.id, addonQty - 1);
                              } else {
                                removeItem(addon.id);
                              }
                            }}
                            className="p-1.5 hover:bg-slate-50 rounded-md transition-colors text-slate-600"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-bold text-slate-900">
                            {addonQty}
                          </span>
                          <button
                            onClick={() => updateQuantity(addon.id, addonQty + 1)}
                            className="p-1.5 hover:bg-slate-50 rounded-md transition-colors text-slate-600"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addItemSimple(addon)}
                          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                          data-testid={`button-add-addon-${addon.id}`}
                        >
                          Add to Booking
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
