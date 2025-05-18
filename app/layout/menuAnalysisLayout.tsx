import type { Route } from "./+types/menuAnalysisLayout";

import { Link, Outlet } from "react-router";




export default function MenuAnalysisLayout({loaderData}: Route.ComponentProps){

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#a4de6c', '#d084d0', '#ffb347'];
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Menu Item Repetition Analysis</h1>
      
      <div className="grid grid-cols-12 gap-4">
        <section id="sidebar-nav" className="h-full col-span-2 flex flex-col gap-2  border-2 border-gray-300 rounded-lg p-4">
          <Link to="/menu-analysis" className="hover:text-blue-500">Diversity</Link>
          <Link to="/menu-analysis/items" className="hover:text-blue-500">Items</Link>
          <Link to="/menu-analysis/timeline" className="hover:text-blue-500">Timeline</Link>
          <Link to="/menu-analysis/customer-timeline" className="hover:text-blue-500">Customer-Timeline</Link>
        </section>
        <section className="col-span-10">
          <Outlet />
        </section>
      </div>
    </div>
  )
}

