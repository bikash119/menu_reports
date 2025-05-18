import { type RouteConfig, index,layout,prefix,route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    ...prefix("/menu-analysis",[
        layout("./layout/menuAnalysisLayout.tsx",[
            index("./routes/menuAnalysis/diversity.tsx"),
            route("items","./routes/menuAnalysis/items.tsx"),
            route("timeline","./routes/menuAnalysis/timeline.tsx"),
            route("customer-timeline","./routes/menuAnalysis/customer-timeline.tsx")
        ])
    ])

] satisfies RouteConfig;
