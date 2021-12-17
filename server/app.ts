import express, { Request, Response, NextFunction } from 'express';
import coursesRoute from './courses/coursesController'

const app = express();
const port = 3000;

app.listen(port, () => {
    console.log(`Golf Trip Planner API is running on port ${port}.`);
});

app.use('/courses', coursesRoute)