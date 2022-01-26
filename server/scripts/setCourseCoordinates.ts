import { supabase } from "../db";
import fetch from "node-fetch";
import { Course } from "../courses/Course";

const STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];

type CourseLocation = Pick<
  Course,
  "id" | "clubName" | "city" | "state" | "lat" | "long"
> & {
  locationQuery: string;
};

const GEOCODING_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places/";
const CHUNK_SIZE = 40;

export const setTownCoordinates = async (states: string[]) => {
  let courseLocations = await getCourseLocationQueries(states);
  courseLocations = await getCourseCoordinates(courseLocations);
  return await upsertCoursesWithNewCoords(courseLocations);
};
const getCourseLocationQueries = async (
  states: string[]
): Promise<CourseLocation[]> => {
  let result: CourseLocation[] = [];
  for (const state of states) {
    const { data, error } = await supabase
      .from("courses")
      .select("id, clubName, city")
      .match({ state, lat: 0 });
    if (!error) {
      console.log(`Returning ${data.length} courses in ${state}`);
      data.forEach((course) => {
        const townSerialized = encodeURI(
          `${course.city} ${state} ${course.clubName}`
        );
        result.push({
          id: course.id,
          clubName: course.clubName,
          city: course.city,
          state,
          lat: 0,
          long: 0,
          locationQuery: `${GEOCODING_URL}${townSerialized}.json?access_token=${process.env.MAPBOX_ACCESS_TOKEN}`,
        });
      });
    } else {
      console.log(error);
    }
  }
  return result;
};

const getCourseCoordinates = async (
  courseLocations: CourseLocation[]
): Promise<CourseLocation[]> => {
  try {
    let idx = 0;
    while (idx < courseLocations.length) {
      const queries = courseLocations.map((course) => course.locationQuery);

      const chunkOfQueries = getNextChunkOfQueries(queries, idx);

      await Promise.all(chunkOfQueries)
        .then((results) => Promise.all(results.map((r) => r.json())))
        .then((values: { features: any[]; query: string[] }[]) => {
          for (let i = 0; i < values.length; i++) {
            if (values[i].features) {
              courseLocations[idx + i].lat = values[i].features[0].center[1];
              courseLocations[idx + i].long = values[i].features[0].center[0];
            } else {
              console.log(
                "No coordinates found for: ",
                courseLocations[idx + i].locationQuery
              );
            }
          }
        })
        .catch((error) => console.log(error));

      idx += chunkOfQueries.length;
      if (idx < courseLocations.length) {
        await new Promise((resolve) => setTimeout(resolve, 61000));
        console.log("Just waited a minute, resuming with course #", idx);
      }
    }
  } catch {
    throw new Error(`Could not find coordinates for all courses`);
  }
  console.log("Returning from getCourseCoordinates");
  return courseLocations;
};

const getNextChunkOfQueries = (
  queries: string[],
  currentIndex: number
): any[] => {
  const topIndex = Math.min(queries.length, currentIndex + CHUNK_SIZE);
  const srtingQueries = queries.slice(currentIndex, topIndex);
  return srtingQueries.map((query) => fetch(query));
};

const upsertCoursesWithNewCoords = async (
  courses: CourseLocation[]
): Promise<any> => {
  let { data, error } = await supabase.from("courses").upsert(
    courses.map((course) => ({
      id: course.id,
      lat: course.lat,
      long: course.long,
    }))
  );
  if (error) {
    console.log(error);
  }
  return data;
};
