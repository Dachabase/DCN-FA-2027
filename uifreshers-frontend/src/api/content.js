import client from "./client";

export const getFaculties = () => client.get("/faculties").then((r) => r.data);
export const getFaculty = (id) => client.get(`/faculties/${id}`).then((r) => r.data);

export const getDepartments = (facultyId) =>
  client
    .get("/departments", { params: facultyId ? { faculty_id: facultyId } : {} })
    .then((r) => r.data);

export const getCourses = (params) => client.get("/courses", { params }).then((r) => r.data);

export const getGuides = (category) =>
  client.get("/guides", { params: category ? { category } : {} }).then((r) => r.data);
export const getGuideBySlug = (slug) => client.get(`/guides/${slug}`).then((r) => r.data);

export const getResources = (category) =>
  client.get("/resources", { params: category ? { category } : {} }).then((r) => r.data);

export const getOpportunities = (type) =>
  client.get("/opportunities", { params: type ? { type } : {} }).then((r) => r.data);

export const getFaqs = () => client.get("/faqs").then((r) => r.data);

export const search = (q) => client.get("/search", { params: { q } }).then((r) => r.data);
