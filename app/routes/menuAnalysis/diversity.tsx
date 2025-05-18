import type { Route } from "./+types/diversity";
import { z } from 'zod';
import Papa from 'papaparse';
import MenuRowSchema from "~/types/finished_goods";
import type { MenuRow } from "~/types/finished_goods"
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend, 
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
        
        return { validatedData:validatedData };
    }catch (error) {
        console.error('Error loading data:', error);
        return { validatedData:[] };
    }
}
/**
 * The Diversity component calculates and displays diversity metrics for menu items.
 * It uses the validatedData from the outlet context to analyze menu variety.
 */
export default function Diversity({loaderData}: Route.ComponentProps){
    const { validatedData }  = loaderData;
    console.log(validatedData.length)
    const analyzeMenuVariety = (validatedData:MenuRow[]) => {
        // Calculate diversity metrics per menu type
        interface MenuTypeDiversityItem {
            uniqueItems: Set<string>;
            customers: Set<string>;
            totalOrders: number;
            itemHistory: Array<{ date: string; item: string; customer: string }>;
            dateItems: Record<string, Set<string>>;
        }
          
        // Define the main type
        type MenuTypeDiversity = Record<string, MenuTypeDiversityItem>;
          
        // Initialize the object with proper typing
        const menuTypeDiversity: MenuTypeDiversity = {};
        interface ItemFrequencyItem  {
            count: number;
            customers: Set<string>;
            dates: Set<string>;
            menuTypes: Set<string>;
        };

        type ItemFrequency = Record<string, ItemFrequencyItem>
        const itemFreq: ItemFrequency = {}
        
        validatedData.forEach((row:MenuRow) => {
          const customer = row.customer_name;
          const date = row.date;
          const item = row.material_description;
          const menuType = row.menu_type;
          
          // Menu type diversity tracking
          if (!menuTypeDiversity[menuType]) {
            menuTypeDiversity[menuType] = {
              uniqueItems: new Set(),
              dateItems: {},
              customers: new Set(),
              totalOrders: 0,
              itemHistory: []
            };
          }
          
          menuTypeDiversity[menuType].uniqueItems.add(item);
          menuTypeDiversity[menuType].customers.add(customer);
          menuTypeDiversity[menuType].totalOrders++;
          menuTypeDiversity[menuType].itemHistory.push({ date, item, customer });
          
          if (!menuTypeDiversity[menuType].dateItems[date]) {
            menuTypeDiversity[menuType].dateItems[date] = new Set();
          }
          menuTypeDiversity[menuType].dateItems[date].add(item);
          
          // Item frequency tracking
          if (!itemFreq[item]) {
            itemFreq[item] = {
              count: 0,
              customers: new Set(),
              dates: new Set(),
              menuTypes: new Set()
            };
          }
          itemFreq[item].count++;
          itemFreq[item].customers.add(customer);
          itemFreq[item].dates.add(date);
          itemFreq[item].menuTypes.add(menuType);
        });
    
        // Calculate diversity scores
        const scores = Object.entries(menuTypeDiversity).map(([menuType, data]) => {
          const customerStats = {
            count: data.customers.size
          };
          
          return {
            menuType,
            totalUniqueItems: data.uniqueItems.size,
            totalOrders: data.totalOrders,
            diversityRatio: data.uniqueItems.size / data.totalOrders,
            avgItemsPerDay: Object.values(data.dateItems).reduce((sum, items) => sum + items.size, 0) / 
                             Math.max(1, Object.keys(data.dateItems).length),
            totalDays: Object.keys(data.dateItems).length,
            customerStats,
            customerCount: data.customers.size,
            itemHistory: data.itemHistory
          };
        });
    
        scores.sort((a, b) => b.diversityRatio - a.diversityRatio);
        
        // Process item frequency
        const itemFreqArray = Object.entries(itemFreq).map(([item, data]) => ({
          item,
          count: data.count,
          customerCount: data.customers.size,
          dateCount: data.dates.size,
          menuTypeCount: data.menuTypes.size
        }));
    
        itemFreqArray.sort((a, b) => b.count - a.count);
        
        // Set default selected menu type
        const defaultMenutype = scores.length > 0 ?scores[0].menuType: "All Meals"
        return {diversityScores: scores, itemFreqArray,defaultMenutype}
      };
    const { diversityScores} = analyzeMenuVariety(validatedData)
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Menu Type Diversity Ranking</h2>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={diversityScores}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="menuType" angle={-45} textAnchor="end" height={100} />
                <YAxis domain={[0, 1]}>
                  <Label
                    value="Diversity Ratio (Unique/Total)"
                    position="insideLeft"
                    angle={-90}
                    style={{ textAnchor: 'middle' }}
                  />
                </YAxis>
                <Tooltip formatter={(value:number) => value.toFixed(3)} />
                <Bar dataKey="diversityRatio" fill="#8884d8" name="Diversity Ratio">
                  <LabelList dataKey="diversityRatio" position="top" formatter={(value:number) => value.toFixed(2)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Unique Items vs Total Orders by Menu Type</h2>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={diversityScores}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="menuType" angle={-45} textAnchor="end" height={100} />
                <YAxis>
                  <Label
                    value="Count"
                    position="insideLeft"
                    angle={-90}
                    style={{ textAnchor: 'middle' }}
                  />
                </YAxis>
                <Tooltip />
                <Legend />
                <Bar dataKey="totalUniqueItems" fill="#82ca9d" name="Unique Items" />
                <Bar dataKey="totalOrders" fill="#ffc658" name="Total Orders" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
}