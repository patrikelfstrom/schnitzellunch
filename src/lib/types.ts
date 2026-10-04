export interface Restaurant {
  id: string;
  title: string;
  address: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
}
export interface MenuItem {
  id: string;
  description: string;
  weekDay: number;
  week: number;
  year: number;
  restaurantId: string;
}
export interface RestaurantWithMenu extends Restaurant {
  menuItems: MenuItem[];
}
export interface CrawledRestaurant extends Omit<Restaurant, "id"> {
  menuItems: Omit<MenuItem, "id" | "restaurantId">[];
}
export function hasCoordinates<T extends Restaurant>(
  r: T,
): r is T & { latitude: number; longitude: number } {
  return (
    r.latitude !== null &&
    r.longitude !== null &&
    Number.isFinite(r.latitude) &&
    Number.isFinite(r.longitude)
  );
}
