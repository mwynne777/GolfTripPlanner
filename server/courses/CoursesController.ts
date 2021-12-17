import express, { Request, Response, NextFunction } from 'express';
import HTMLParser from 'node-html-parser';
import fetch from 'node-fetch'
import {Course} from './Course'

const router = express.Router()

const BASE_URL = 'https://ncrdb.usga.org/courseTeeInfo.aspx?CourseID=';

router.get('/:id', async (req,res) =>{
    console.log("Hit the Courses endpoint")
    let {id} = req.params;
    const course = await fetchCourseAndRatingById(parseInt(id))
    return res.json(course); 
 });

 const fetchCourseAndRatingById = async (id: number) => {
    const result = await fetch(BASE_URL + id);
    if (!result.ok) {
        console.log(`Error, course id ${id} does not exist`);
        return { error: `Could not find course with id ${id}` }
    }
    const resultText = await result.text();
    const course = parseCourseResult(resultText, id);
    course.id = id;
    return course;
};

const parseCourseResult = (htmlResult, id: number): Course => {
    const root = HTMLParser(htmlResult);
    const courseTable = root.querySelector('#gvCourseTees');
    const [clubAndCourseName, city, state] = courseTable.querySelectorAll('td');
    const [clubName, courseName] = clubAndCourseName.text.split(' - ');
    const course: Course = { id, clubName, courseName, city: city.text, state: state.text, par: 0, rating: 0 };

    const teeTable = root.querySelector('#gvTee');
    if (teeTable != null) {
        const tableRows = teeTable.querySelectorAll('tr');
        tableRows.shift();
        tableRows.forEach(row => {
            const [_, __, par, courseRating] = row.querySelectorAll('td');

            course.par = parseInt(par.text),
            course.rating = parseFloat(courseRating.text)
        });
    }
    return course;
};

export default router