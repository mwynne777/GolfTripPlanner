import express, { Request, Response, NextFunction } from 'express';
import HTMLParser from 'node-html-parser';
import fetch from 'node-fetch'
import {Course} from './Course'
import { supabase } from '../db';
import dotenv from 'dotenv'

const result = dotenv.config();
if (result.error) {
  throw result.error;
}

const router = express.Router()

const BASE_URL = 'https://ncrdb.usga.org/courseTeeInfo.aspx?CourseID=';

router.get('/loadCourse/:id', async (req, res) => {
    console.log('Hit loading endpoint')
    let {id} = req.params;
    let currentId = parseInt(id)
    for(let outter = 0; outter < 10; outter++) {
        const coursesToInsert: Course[] = []
        for(let i = 0; i < 100; i++) {
            const course = await fetchCourseAndRatingById(currentId)
            if(!('error' in course)) {
                coursesToInsert.push(course)
            }
            currentId++;
        }
        let status: 'success' | 'error' = 'success'

        try {
            await supabase.from('courses').insert(coursesToInsert)
            console.log(`Pushed ${coursesToInsert.length} records`)
        } catch {
            status = 'error'
            console.log(`Error with iteration number ${outter}`)
        }
    }

    return res.json({status})
})

router.get('/:id', async (req,res) => {
    console.log("Hit the Course by ID endpoint")
    let { id } = req.params;
    const { data } = await supabase.from('courses').select('*').eq('id', parseInt(id)).single()
    const { clubName } = data

    const clubNameSerialized = encodeURI(clubName)
    console.log(clubNameSerialized)
    const geocodingUrl = 'https://api.mapbox.com/geocoding/v5/mapbox.places/'
    const location = await fetch(`${geocodingUrl}${clubNameSerialized}}.json?access_token=${process.env.MAPBOX_ACCESS_TOKEN}`)
    if(!location.error) {
        const { features } = await location.json()
        return res.json(features[0].center); 
    } else {
        console.log(location.error)
    }

 });

 router.get('/state/:state', async (req, res) => {
     console.log("Hit the Course by State endpoint")
     let { state } = req.params
     const { data } = await supabase.from('courses').select('*').eq('state', state)
     console.log(`Returning ${data.length} courses in ${state}`)
     return res.json(data);
 })

 router.get('/stateFunction/:state', async (req, res) => {
    console.log("Hit the Towns by State endpoint")
    let { state } = req.params
    const { data, error } = await supabase.rpc('gettownsinstate', { inputstate: state })
    if(!error) {
        console.log(`Returning ${data.length} courses in ${state}`)
        return res.json(data);
    } else {
        console.log(error)
    }
})

 router.get('/', async (req, res) => {
    console.log('Hit endpoint to get all courses')
    const {data} = await supabase.from('courses')
    return res.json(data)
 })


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
        if(tableRows.length > 0) {
                const [_, __, par, courseRating] = tableRows[0].querySelectorAll('td');
    
                course.par = parseInt(par.text),
                course.rating = parseFloat(courseRating.text)
        }
    }
    return course;
};

export default router