import { Router } from 'express';
import db from '../db/db.ts';
import redisClient from '../db/redis.ts';
import { eq, ilike, and, count } from 'drizzle-orm';
import { products } from '../db/schema.ts';
import { publicCatalogLimiter } from '../middlewares/rateLimiter.ts';

const productsRouter = Router();

// 1. Fetch All Products with Search and Filter support
productsRouter.get('/', publicCatalogLimiter, async (req, res) => {
    const { category, search, page, limit } = req.query;

    // 2. Parse numbers with safe defaults (Page 1, 20 items per page)
    const parsedPage = Math.max(1, parseInt(page as string) || 1);
    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit as string) || 20)); // Cap limit at 100 max
    const calculatedOffset = (parsedPage - 1) * parsedLimit;

    const cacheKey = `products:cat=${category || 'all'}:search=${search || 'none'}:p=${page || 1}:l=${limit || 20}`;

    try {
        // 2. CHECK REDIS FIRST (The Cache Hit Attempt)
        const cachedData = await redisClient.get(cacheKey);

        if (cachedData && typeof cachedData === 'string') {
            // High-Speed Win: Return data out of RAM in under 2ms!
            console.log('⚡ Redis Cache Hit!');
            return res.json(JSON.parse(cachedData));
        }

        const conditions = [];

        // Filter by category if provided
        if (category) {
            conditions.push(eq(products.category, category as string));
        }

        // Search by name (case-insensitive) if provided
        if (search) {
            conditions.push(ilike(products.name, `%${search}%`));
        }

        const data = await db.query.products.findMany({
            where: conditions.length > 0 ? and(...conditions) : undefined,
            limit: parsedLimit, // How many rows to fetch
            offset: calculatedOffset, // How many rows to skip
            orderBy: (products, { asc }) => [asc(products.id)], // Keeps sorting consistent across pages
            // limit: 20 // Good practice to limit results
        });

        // 4. Fetch total item count (Crucial for frontend to calculate total pages)
        const [totalCountResult] = await db
            .select({ total: count() })
            .from(products)
            .where(conditions.length > 0 ? and(...conditions) : undefined);

        const totalItems = totalCountResult?.total || 0;
        const totalPages = Math.ceil(totalItems / parsedLimit);

        const responsePayload = {
            metadata: {
                currentPage: parsedPage,
                itemsPerPage: parsedLimit,
                totalItems,
                totalPages,
                hasNextPage: parsedPage < totalPages,
                hasPreviousPage: parsedPage > 1,
            },
            products: data,
        };

        await redisClient.set(cacheKey, JSON.stringify(responsePayload), {
            EX: 3600,
        });

        return res.json(responsePayload);
    } catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).json({ error: 'Failed to fetch products.' });
    }
});

// 2. Fetch a Single Product by ID
productsRouter.get<{ id: string }>('/:id', publicCatalogLimiter, async (req, res) => {
    const productId = parseInt(req.params.id);

    if (isNaN(productId)) {
        return res.status(400).json({ error: 'Invalid product ID format.' });
    }

    // 2. Define the standard cache key
    const cacheKey = `products:${productId}`;

    try {
        const cachedProduct = await redisClient.get(cacheKey);

        if (cachedProduct && typeof cachedProduct === 'string') {
            console.log(`⚡ Redis Cache Hit for product ${productId}`);
            return res.json(JSON.parse(cachedProduct));
        }

        console.log(`🐢 Redis Cache Miss. Fetching product ${productId} from PostgreSQL...`);
        const product = await db.query.products.findFirst({
            where: eq(products.id, productId),
        });

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        await redisClient.set(cacheKey, JSON.stringify(product), {
            EX: 86400,
        });

        return res.json(product);
    } catch (error) {
        console.error('Error fetching product details:', error);
        return res.status(500).json({ error: 'Failed to fetch product details.' });
    }
});

export default productsRouter;

/*

frontend produccts fetch by category and search

import { useState, useEffect } from 'react';

export default function ProductList() {
  // 1. Maintain state for both inputs
  const [category, setCategory] = useState('fruits');
  const [search, setSearch] = useState('apple');
  const [products, setProducts] = useState([]);

  useEffect(() => {
    // 2. Combine both values into a single URL query string
    const queryParams = new URLSearchParams();

    if (category) queryParams.append('category', category);
    if (search) queryParams.append('search', search);

    // This generates: "category=fruits&search=apple"
    const queryString = queryParams.toString();

    // 3. Send one single request with both filters
    fetch(`/api/products?${queryString}`)
      .then(res => res.json())
      .then(data => setProducts(data));

  }, [category, search]); // Re-run whenever category or search changes

  return (
    <div>
      // Category Dropdown
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="fruits">Fruits</option>
        <option value="vegetables">Vegetables</option>
      </select>

      // Search Input
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search..."
      />
    </div>
  );
}
  */

/*

single product fetch by id with 404 handling

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api'; // The custom Axios instance we created earlier

// Define what a product looks like in TypeScript
interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  stockKg: number;
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>(); // 1. Grab 'id' from URL (e.g., "4")
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProductDetails() {
      try {
        setLoading(true);
        // 2. Fire request to your backend: GET http://localhost:5000/api/products/4
        const response = await api.get(`/products/${id}`);

        setProduct(response.data); // Save the backend response object to state
      } catch (err: any) {
        console.error(err);
        // 3. Catch the 404 error if your backend returned "Product not found"
        if (err.response?.status === 404) {
          setError("This grocery item does not exist in our inventory.");
        } else {
          setError("Failed to load product details. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    }

    if (id) fetchProductDetails();
  }, [id]);

  if (loading) return <p>Loading fresh groceries...</p>;
  if (error) return <div className="error-box"><p>{error}</p><button onClick={() => navigate('/')}>Go Home</button></div>;
  if (!product) return null;

  return (
    <div className="product-detail-container">
      <h1>{product.name}</h1>
      <p className="category">Category: {product.category}</p>
      <p className="price">Price: ₹{product.price} / kg</p>
      <p className={product.stockKg > 0 ? "in-stock" : "out-of-stock"}>
        {product.stockKg > 0 ? `In Stock: ${product.stockKg}kg remaining` : "Out of Stock"}
      </p>

      <button disabled={product.stockKg === 0} className="add-to-cart-btn">
        Add to Delivery Basket
      </button>
    </div>
  );
}
    */
