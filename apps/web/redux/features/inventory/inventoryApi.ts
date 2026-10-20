import { baseApi } from "@/redux/api/baseApi";
import type { Ingredient, IngredientUnit, StockMovement } from "@react-menu/contracts";

const listTag = (storeId: string) => ({ type: "Ingredient" as const, id: `store-${storeId}` });

type IngredientInput = { name: string; unit: IngredientUnit; minStock?: number; stockQuantity?: number };
type RecipeLine = { ingredientId: number; quantity: number };

export const inventoryApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getIngredients: build.query<Ingredient[], string>({
      query: (storeId) => `stores/${storeId}/ingredients`,
      providesTags: (_res, _err, storeId) => [listTag(storeId)],
    }),
    createIngredient: build.mutation<Ingredient, { storeId: string; data: IngredientInput }>({
      query: ({ storeId, data }) => ({ url: `stores/${storeId}/ingredients`, method: "POST", body: data }),
      invalidatesTags: (_res, _err, { storeId }) => [listTag(storeId)],
    }),
    updateIngredient: build.mutation<
      Ingredient,
      { storeId: string; id: number; data: Partial<Omit<IngredientInput, "stockQuantity">> }
    >({
      query: ({ storeId, id, data }) => ({ url: `stores/${storeId}/ingredients/${id}`, method: "PUT", body: data }),
      invalidatesTags: (_res, _err, { storeId }) => [listTag(storeId)],
    }),
    deleteIngredient: build.mutation<void, { storeId: string; id: number }>({
      query: ({ storeId, id }) => ({ url: `stores/${storeId}/ingredients/${id}`, method: "DELETE" }),
      invalidatesTags: (_res, _err, { storeId }) => [listTag(storeId)],
    }),
    getStockMovements: build.query<StockMovement[], { storeId: string; id: number }>({
      query: ({ storeId, id }) => `stores/${storeId}/ingredients/${id}/movements`,
      providesTags: (_res, _err, { id }) => [{ type: "Ingredient", id }],
    }),
    recordStockMovement: build.mutation<
      Ingredient,
      { storeId: string; id: number; data: { type: "purchase" | "waste" | "adjustment"; quantity: number; note?: string } }
    >({
      query: ({ storeId, id, data }) => ({ url: `stores/${storeId}/ingredients/${id}/movements`, method: "POST", body: data }),
      invalidatesTags: (_res, _err, { storeId, id }) => [listTag(storeId), { type: "Ingredient", id }],
    }),
    getItemRecipe: build.query<Ingredient[], { storeId: string; itemId: string }>({
      query: ({ storeId, itemId }) => `stores/${storeId}/items/${itemId}/recipe`,
      providesTags: (_res, _err, { itemId }) => [{ type: "Ingredient", id: `item-${itemId}` }],
    }),
    updateItemRecipe: build.mutation<Ingredient[], { storeId: string; itemId: string; ingredients: RecipeLine[] }>({
      query: ({ storeId, itemId, ingredients }) => ({
        url: `stores/${storeId}/items/${itemId}/recipe`,
        method: "PUT",
        body: { ingredients },
      }),
      invalidatesTags: (_res, _err, { itemId }) => [{ type: "Ingredient", id: `item-${itemId}` }],
    }),
  }),
});

export const {
  useGetIngredientsQuery,
  useCreateIngredientMutation,
  useUpdateIngredientMutation,
  useDeleteIngredientMutation,
  useGetStockMovementsQuery,
  useRecordStockMovementMutation,
  useGetItemRecipeQuery,
  useUpdateItemRecipeMutation,
} = inventoryApi;
