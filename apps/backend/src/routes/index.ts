import { Router } from 'express';
import productsRouter from './product-routes.ts';
import customersRouter from './customer-routes.ts';
import ordersRouter from './orders-routes.ts';
import loginRouter from './login-routes.ts';
import logoutRouter from './logout-routes.ts';
import adminRouter from './admin-routes.ts';
import payoutRouter from './payout-routes.ts';
import geoRouter from './georouter.ts';
import paymentsRouter from './payment-routes.ts';
import driverRouter from './driver-routes.ts';
import cartRouter from './cart-routes.ts';

const appRouter = Router();

appRouter.use('/products', productsRouter);
appRouter.use('/admin', adminRouter);
appRouter.use('/customers', customersRouter);
appRouter.use('/orders', ordersRouter);
appRouter.use('/login', loginRouter);
appRouter.use('/logout', logoutRouter);
appRouter.use('/payout', payoutRouter);
appRouter.use('/geo', geoRouter);
appRouter.use('/payment', paymentsRouter);
appRouter.use('/driver', driverRouter);
appRouter.use('/cart', cartRouter);

export default appRouter;
