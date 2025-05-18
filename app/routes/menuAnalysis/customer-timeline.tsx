import type { Route } from "./+types/timeline";
import { useState } from 'react';
import { z } from 'zod';
import Papa from 'papaparse';
import MenuRowSchema from "~/types/finished_goods";
import type { MenuRow } from "~/types/finished_goods";
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend, 
    ResponsiveContainer, 
    LineChart, 
    Line, 
    PieChart, 
    Pie, 
    Cell, 
    Label, 
    LabelList 
  } from 'recharts';
export async function clientLoader({request,context}: Route.LoaderArgs){
    try {
        const response = await fetch('/data/combined_df.csv' );
        const fileContent = await response.text();
        const parsedData = Papa.parse(fileContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
        });

        const validatedData = z.array(MenuRowSchema).parse(parsedData.data);
        const uniqueMenuTypes = [...new Set(validatedData.map(row => row.menu_type))].sort();
        const uniqueCustomers = [...new Set(validatedData.map(row => row.customer_name))].sort();
        const allDates = [...new Set(validatedData.map(row => row.date))].sort();
        const dateRange = { start: allDates[0], end: allDates[allDates.length-1]}
        
        return { validatedData:validatedData,allDates: allDates,dateRange: dateRange,uniqueMenuTypes: uniqueMenuTypes,uniqueCustomers: uniqueCustomers };
    }catch (error) {
        console.error('Error loading data:', error);
        return { validatedData:[] };
    }
}
interface DateMenuTypeGroupItem {
    date: string;
    menuType: string;
    uniqueItems: Set<string>;
    totalItems: number;
}
const TimeLineDateItems = z.array(z.object({
    date: z.string(),
    menuType: z.string(),
    uniqueItems: z.number(),
    totalItems: z.number(),
    repeatedItems: z.number(),
    variety: z.number(),
}))
type DateMenuTypeGroups = Record<string, DateMenuTypeGroupItem>

const dateMenuTypeGroups: DateMenuTypeGroups = {}

function analyzeCustomerTimeline (customer:string, startDate:string|undefined, endDate: string|undefined, validatedData: any[]) {
    // Filter data for the selected customer and date range
    const filteredData = validatedData.filter(row => {
      const customerMatch = row.customer_name === customer;
      const dateMatch = row.date >= startDate! && row.date <= endDate!;
      
      return customerMatch && dateMatch;
    });
    
    
    filteredData.forEach(row => {
      const date = row.date;
      const menuType = row.menu_type;
      const key = `${date}-${menuType}`;
      
      if (!dateMenuTypeGroups[key]) {
        dateMenuTypeGroups[key] = {
          date,
          menuType,
          uniqueItems: new Set(),
          totalItems: 0
        };
      }
      
      dateMenuTypeGroups[key].uniqueItems.add(row.material_description);
      dateMenuTypeGroups[key].totalItems++;
    });
    
    // Convert to array for timeline visualization
    const timelineData:z.infer<typeof TimeLineDateItems> = Object.values(dateMenuTypeGroups).map(group => ({
      date: group.date,
      menuType: group.menuType,
      uniqueItems: group.uniqueItems.size,
      totalItems: group.totalItems,
      repeatedItems: group.totalItems - group.uniqueItems.size,
      variety: group.uniqueItems.size / group.totalItems
    }));
    
    // Sort by date
    timelineData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return {customerTimelineData: timelineData};
  };
export default function CustomerTimeline({loaderData}: Route.ComponentProps){
    const { validatedData, allDates,dateRange,uniqueMenuTypes,uniqueCustomers} = loaderData;
    const [selectedCustomer, setSelectedCustomer] = useState('All Customers');
    const {customerTimelineData} = analyzeCustomerTimeline(selectedCustomer,dateRange?.start,dateRange?.end,validatedData)
    const formatDate = (dateStr:string) => {
        const date = new Date(dateStr);
        return `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;
      };
    const formatTooltip = (value:number, name:string) => {
        if (name === "variety") {
          return [`${(value * 100).toFixed(1)}%`, "Variety Score"];
        }
        return [value, name];
    };
    return (
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="mb-6">
            {/* First row: Customer selection */}
            <div className="flex flex-col md:flex-row md:items-end mb-4 space-y-4 md:space-y-0 md:space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Select Customer:</label>
                <select 
                  value={selectedCustomer}
                  onChange={(e) => setSelectedCustomer(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {uniqueCustomers && uniqueCustomers.map(customer => (
                    <option key={customer} value={customer}>
                      {customer}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <div className="h-6"></div> {/* Spacer to align with other row */}
                {selectedCustomer === 'All Customers' && (
                  <div className="px-3 py-2 text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-md">
                    Please select a specific customer for timeline analysis
                  </div>
                )}
              </div>
            </div>
            
            {/* Second row: Date range selection */}
            <div className="flex flex-col md:flex-row md:items-end space-y-4 md:space-y-0 md:space-x-4">
              {/* <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Start Date:</label>
                <input 
                  type="date" 
                  value={dateRange?.start}
                  onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">End Date:</label>
                <input 
                  type="date" 
                  value={dateRange?.end}
                  onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div> */}
            </div>
          </div>

          <h2 className="text-xl font-semibold mb-4">
            Customer Timeline Analysis for {selectedCustomer}
          </h2>
          
          {(selectedCustomer === 'All Customers' || customerTimelineData.length === 0) && (
            <div className="p-4 bg-yellow-50 rounded border border-yellow-200 text-center">
              <p>{selectedCustomer === 'All Customers' 
                ? 'Please select a specific customer to view their timeline analysis.' 
                : 'No data available for the selected customer and date range. Try adjusting your filters.'}
              </p>
            </div>
          )}
          
          {selectedCustomer !== 'All Customers' && customerTimelineData.length > 0 && (
            <div className="grid grid-cols-1 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-3">Menu Variety Timeline</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={customerTimelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={formatDate}
                      angle={-45} 
                      textAnchor="end" 
                      height={100} 
                    />
                    <YAxis yAxisId="left">
                      <Label
                        value="Item Count"
                        position="insideLeft"
                        angle={-90}
                        style={{ textAnchor: 'middle' }}
                      />
                    </YAxis>
                    <YAxis yAxisId="right" orientation="right" domain={[0, 1]}>
                      <Label
                        value="Variety Score"
                        position="insideRight"
                        angle={90}
                        style={{ textAnchor: 'middle' }}
                      />
                    </YAxis>
                    <Tooltip 
                      formatter={formatTooltip} 
                      labelFormatter={formatDate}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-3 border rounded shadow-sm">
                              <p className="font-semibold">{formatDate(data.date)} - {data.menuType}</p>
                              <p>Unique Items: {data.uniqueItems}</p>
                              <p>Total Items: {data.totalItems}</p>
                              <p>Repeated Items: {data.repeatedItems}</p>
                              <p>Variety Score: {(data.variety * 100).toFixed(1)}%</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Line 
                      yAxisId="left" 
                      type="monotone" 
                      dataKey="uniqueItems" 
                      stroke="#8884d8" 
                      name="Unique Items" 
                      dot={{ r: 4 }}
                    />
                    <Line 
                      yAxisId="left" 
                      type="monotone" 
                      dataKey="totalItems" 
                      stroke="#ffc658" 
                      name="Total Items" 
                      dot={{ r: 4 }}
                    />
                    <Line 
                      yAxisId="left" 
                      type="monotone" 
                      dataKey="repeatedItems" 
                      stroke="#ff7c7c" 
                      name="Repeated Items" 
                      dot={{ r: 4 }}
                    />
                    <Line 
                      yAxisId="right" 
                      type="monotone" 
                      dataKey="variety" 
                      stroke="#82ca9d" 
                      name="Variety Score" 
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {selectedCustomer !== 'All Customers' && customerTimelineData.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">Timeline Details by Date and Menu Type</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="py-2 px-4 border-b">Date</th>
                      <th className="py-2 px-4 border-b">Menu Type</th>
                      <th className="py-2 px-4 border-b">Unique Items</th>
                      <th className="py-2 px-4 border-b">Total Items</th>
                      <th className="py-2 px-4 border-b">Repeated Items</th>
                      <th className="py-2 px-4 border-b">Variety Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerTimelineData.map((day, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="py-2 px-4 border-b">{formatDate(day.date)}</td>
                        <td className="py-2 px-4 border-b">{day.menuType}</td>
                        <td className="py-2 px-4 border-b text-center">{day.uniqueItems}</td>
                        <td className="py-2 px-4 border-b text-center">{day.totalItems}</td>
                        <td className="py-2 px-4 border-b text-center">{day.repeatedItems}</td>
                        <td className="py-2 px-4 border-b text-center">{(day.variety * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedCustomer !== 'All Customers' && customerTimelineData.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-100 rounded">
                <h3 className="font-semibold mb-2">Customer Timeline Statistics</h3>
                <div>
                  <p><strong>Total Days with Orders:</strong> {new Set(customerTimelineData.map(item => item.date)).size}</p>
                  <p><strong>Total Menu Types Used:</strong> {new Set(customerTimelineData.map(item => item.menuType)).size}</p>
                  <p><strong>Average Variety Score:</strong> {(customerTimelineData.reduce((sum, day) => sum + day.variety, 0) / customerTimelineData.length * 100).toFixed(1)}%</p>
                  <p><strong>Average Unique Items per Day-Menu:</strong> {(customerTimelineData.reduce((sum, day) => sum + day.uniqueItems, 0) / customerTimelineData.length).toFixed(1)}</p>
                  <p><strong>Average Total Items per Day-Menu:</strong> {(customerTimelineData.reduce((sum, day) => sum + day.totalItems, 0) / customerTimelineData.length).toFixed(1)}</p>
                </div>
              </div>
              <div className="p-4 bg-gray-100 rounded">
                <h3 className="font-semibold mb-2">Insights & Definitions</h3>
                <p><strong>Timeline Analysis:</strong> Shows how menu variety changes over time for this customer</p>
                <p><strong>Menu Type Breakdown:</strong> Reveals patterns across different meal types</p>
                <p><strong>Day-Menu:</strong> A specific combination of date and menu type</p>
                <p><strong>Variety Score:</strong> Unique Items ÷ Total Items (higher means more diverse menu)</p>
                <p><strong>Tracking variety over time can reveal customer satisfaction trends</strong></p>
              </div>
            </div>
          )}
        </div>
      )
}