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
    ResponsiveContainer, 
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

// Count occurrences of each item
interface ItemEntries {
    count: number;
    dates: Set<string>;
    customers: Set<string>
}
interface ItemArrayEntries {
    item: string;
    count : number;
    uniqueDates: number;
    uniqueCustomers: number;
    repeatFactor : number;
}
type ItemCounts = Record<string, ItemEntries>
const itemCounts: ItemCounts = {}

function analyzeItemRepetition (menuType: string, startDate: string|undefined, endDate: string|undefined, customer: string,validatedData: any[])  {
    // Filter data for the selected menu type and date range
    const filteredData = validatedData.filter((row:MenuRow) => {
      const menuTypeMatch = row.menu_type === menuType;
      const dateMatch = row.date >= startDate! && row.date <= endDate!;
      const customerMatch = customer === 'All Customers' || row.customer_name === customer;
      
      return menuTypeMatch && dateMatch && customerMatch;
    });
    
    
    filteredData.forEach((row:MenuRow) => {
      const item = row.material_description;
      if (!itemCounts[item]) {
        itemCounts[item] = {
          count: 0,
          dates: new Set(),
          customers: new Set()
        };
      }
      itemCounts[item].count++;
      itemCounts[item].dates.add(row.date);
      itemCounts[item].customers.add(row.customer_name);
    });
    
    // Convert to array for easier manipulation
    const itemsArray = Object.entries(itemCounts).map(([item, data]) => ({
      item,
      count: data.count,
      uniqueDates: data.dates.size,
      uniqueCustomers: data.customers.size,
      repeatFactor: data.count / Math.max(1, data.dates.size) // Average times item appears per date
    }));
    
    // Sort by count (highest first)
    itemsArray.sort((a, b) => b.count - a.count);
    
    // Count items by repetition frequency
    const repetitionCounts = {
      'Appeared once': 0,
      'Repeated 2-3 times': 0,
      'Repeated 4-5 times': 0,
      'Repeated 6-10 times': 0,
      'Repeated 11+ times': 0
    };
    
    itemsArray.forEach(item => {
      if (item.count === 1) {
        repetitionCounts['Appeared once']++;
      } else if (item.count >= 2 && item.count <= 3) {
        repetitionCounts['Repeated 2-3 times']++;
      } else if (item.count >= 4 && item.count <= 5) {
        repetitionCounts['Repeated 4-5 times']++;
      } else if (item.count >= 6 && item.count <= 10) {
        repetitionCounts['Repeated 6-10 times']++;
      } else {
        repetitionCounts['Repeated 11+ times']++;
      }
    });
    
    const repetitionData = Object.entries(repetitionCounts).map(([category, count]) => ({
      category,
      count
    }));

    return { itemRepetitionData: repetitionData,repeatedItemsList: itemsArray}
  };

export default function Timeline({loaderData}: Route.ComponentProps){
    const [ selectedMenuType, setSelectedMenuType] = useState('')
    const [selectedCustomer, setSelectedCustomer] = useState('All Customers');
    const [sortConfig, setSortConfig] = useState({
        key: 'count',
        direction: 'descending'
      });
    const { validatedData, allDates,dateRange,uniqueMenuTypes,uniqueCustomers} = loaderData;
    const { itemRepetitionData,repeatedItemsList} = analyzeItemRepetition(
        selectedMenuType,dateRange?.start,dateRange?.end,selectedCustomer,validatedData)
    const getSortedItems = (items) => {
        if (!items || items.length === 0) return [];
        
        const sortableItems = [...items];
        sortableItems.sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (a[sortConfig.key] > b[sortConfig.key]) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });
        return sortableItems;
    };
    const requestSort = (key:string) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
          direction = 'descending';
        }
        setSortConfig({ key, direction });
    };
        
    return (
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="mb-6">
            {/* First row: Menu Type and Customer in one horizontal line */}
            <div className="flex flex-col md:flex-row md:items-end mb-4 space-y-4 md:space-y-0 md:space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Select Menu Type:</label>
                <select 
                  value={selectedMenuType}
                  onChange={(e) => setSelectedMenuType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {uniqueMenuTypes && uniqueMenuTypes.map(menuType => (
                    <option key={menuType} value={menuType}>
                      {menuType}
                    </option>
                  ))}
                </select>
              </div>
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
            </div>
            
            {/* Second row: Start Date and End Date in one horizontal line */}
            <div className="flex flex-col md:flex-row md:items-end space-y-4 md:space-y-0 md:space-x-4">
              {/* <div className="flex-1">
                <label className="block text-sm font-medium mb-2">Start Date:</label>
                <input 
                  type="date" 
                  value={dateRange.start}
                  onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">End Date:</label>
                <input 
                  type="date" 
                  value={dateRange.end}
                  onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div> */}
            </div>
          </div>

          <h2 className="text-xl font-semibold mb-4">
            Item Repetition Analysis for {selectedMenuType}
            {selectedCustomer !== 'All Customers' && ` - ${selectedCustomer}`}
          </h2>
          
          {repeatedItemsList.length === 0 && (
            <div className="p-4 bg-yellow-50 rounded border border-yellow-200 text-center">
              <p>No data available for the selected menu type and date range. Try adjusting your filters.</p>
            </div>
          )}
          
          {repeatedItemsList.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-3">Item Repetition Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={itemRepetitionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis>
                      <Label
                        value="Number of Items"
                        position="insideLeft"
                        angle={-90}
                        style={{ textAnchor: 'middle' }}
                      />
                    </YAxis>
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" name="Number of Items">
                      <LabelList dataKey="count" position="top" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-3">Top Repeated Items</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={repeatedItemsList.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="item" angle={-45} textAnchor="end" height={120} />
                    <YAxis>
                      <Label
                        value="Times Repeated"
                        position="insideLeft"
                        angle={-90}
                        style={{ textAnchor: 'middle' }}
                      />
                    </YAxis>
                    <Tooltip />
                    <Bar dataKey="count" fill="#82ca9d" name="Times Repeated">
                      <LabelList dataKey="count" position="top" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {repeatedItemsList.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">
                Repeated Items Details 
                <span className="text-sm font-normal ml-2">(Click column headers to sort)</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th 
                        className="py-2 px-4 border-b cursor-pointer hover:bg-gray-200"
                        onClick={() => requestSort('item')}
                      >
                        Item
                        {sortConfig.key === 'item' && (
                          <span className="ml-1">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>
                        )}
                      </th>
                      <th 
                        className="py-2 px-4 border-b cursor-pointer hover:bg-gray-200"
                        onClick={() => requestSort('count')}
                      >
                        Total Appearances
                        {sortConfig.key === 'count' && (
                          <span className="ml-1">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>
                        )}
                      </th>
                      <th 
                        className="py-2 px-4 border-b cursor-pointer hover:bg-gray-200"
                        onClick={() => requestSort('uniqueDates')}
                      >
                        Unique Dates
                        {sortConfig.key === 'uniqueDates' && (
                          <span className="ml-1">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>
                        )}
                      </th>
                      <th 
                        className="py-2 px-4 border-b cursor-pointer hover:bg-gray-200"
                        onClick={() => requestSort('uniqueCustomers')}
                      >
                        Unique Customers
                        {sortConfig.key === 'uniqueCustomers' && (
                          <span className="ml-1">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>
                        )}
                      </th>
                      <th 
                        className="py-2 px-4 border-b cursor-pointer hover:bg-gray-200"
                        onClick={() => requestSort('repeatFactor')}
                      >
                        Repeat Factor
                        {sortConfig.key === 'repeatFactor' && (
                          <span className="ml-1">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>
                        )}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSortedItems(repeatedItemsList).slice(0, 20).map((item, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="py-2 px-4 border-b">{item.item}</td>
                        <td className="py-2 px-4 border-b text-center">{item.count}</td>
                        <td className="py-2 px-4 border-b text-center">{item.uniqueDates}</td>
                        <td className="py-2 px-4 border-b text-center">{item.uniqueCustomers}</td>
                        <td className="py-2 px-4 border-b text-center">{item.repeatFactor.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {repeatedItemsList.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-100 rounded">
                <h3 className="font-semibold mb-2">Summary Statistics</h3>
                <div>
                  <p><strong>Total Unique Items:</strong> {repeatedItemsList.length}</p>
                  <p><strong>Total Item Appearances:</strong> {repeatedItemsList.reduce((sum, item) => sum + item.count, 0)}</p>
                  <p><strong>Items Appearing Once:</strong> {itemRepetitionData.find(d => d.category === 'Appeared once')?.count || 0} items ({((itemRepetitionData.find(d => d.category === 'Appeared once')?.count || 0) / repeatedItemsList.length * 100).toFixed(1)}%)</p>
                  <p><strong>Items Repeated 11+ times:</strong> {itemRepetitionData.find(d => d.category === 'Repeated 11+ times')?.count || 0} items</p>
                  <p><strong>Average Repetitions:</strong> {(repeatedItemsList.reduce((sum, item) => sum + item.count, 0) / Math.max(1, repeatedItemsList.length)).toFixed(2)} times per item</p>
                  <p><strong>Customer Filter:</strong> {selectedCustomer === 'All Customers' ? 'All Customers (no filter)' : selectedCustomer}</p>
                </div>
              </div>
              <div className="p-4 bg-gray-100 rounded">
                <h3 className="font-semibold mb-2">Insights & Definitions</h3>
                <p><strong>Total Appearances:</strong> Total number of times an item appears in the menu</p>
                <p><strong>Unique Dates:</strong> Number of different dates the item appears</p>
                <p><strong>Repeat Factor:</strong> Average number of times the item appears per date</p>
                <p><strong>Higher repeat factor indicates more frequent repetition</strong></p>
                <p><strong>Customer Analysis:</strong> Filter by customer to compare menu variety across different customers</p>
              </div>
            </div>
          )}
        </div>
      )
}