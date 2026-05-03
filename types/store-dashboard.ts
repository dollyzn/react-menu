export interface StoreOverview {
  accesses: {
    total: number;
    message: string;
  };
  categories: {
    total: number;
    message: string;
  };
  items: {
    total: number;
    message: string;
  };
  addons: {
    total: number;
    message: string;
  };
}

export interface StoreOverviewChartPoint {
  date: string;
  desktop: number;
  mobile: number;
}
