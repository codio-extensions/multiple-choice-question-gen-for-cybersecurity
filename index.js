// Wrapping the whole extension in a JS function
// (ensures all global variables set in this extension cannot be referenced outside its scope)
(async function(codioIDE, window) {
 // System prompt for generating question ideas from learning objectives
const ideaGenerationSystemPrompt = `You are a computer science instructor teaching Cyber security courses with an expertise in drafting question ideas
for multiple choice assessments. You will be provided with learning objectives and the number of question ideas required. Your task is to create the required 
number of multiple choice question ideas ordered by difficulty (Beginner, Intermediate, Hard) and topic sequence. 

**Example Question Ideas:**
- Create an idea for demonstrating variable naming rules through declaring multiple variables of different types 
and ensuring proper naming conventions are followed while printing their values. (Easy)
- Develop an idea for a program that involves declaring, initializing, reassigning, 
and printing integer variables multiple times to show variable manipulation concepts. (Intermediate)  
- Design an idea for a program that explores data type handling through arithmetic operations between different numeric types 
and proper result display. (Hard)

**Output Format:**
<idea id=1>
Idea 1: ... (Easy)
</idea>
<idea id=2>
Idea 2: ... (Intermediate)  
</idea>
<idea id=3>
Idea 3: ... (Hard)
</idea>
...

**Important Notes:**
- Do not include ideas for topics not yet covered in the learning objectives.
- Vary the correct answer positions - some should have the correct answer as option A, some as B, C, or D.
- Include specific guidance on what the correct answer should be and plausible incorrect options.`

// User prompt for generating question ideas
const ideaGenerationPrompt = `
Here are the learning objectives:
<learning_objectives>
{learning_objectives}
<learning_objectives>

Generate exactly {number_of_questions} question ideas based on the learning objectives provided.
Note:
- Ensure there are {number_of_questions} ideas in total, covering a mix of difficulties.
- Do not include ideas for topics not yet covered in the learning objectives.
`

// register the button in Coach Bot
codioIDE.coachBot.register("generateMCQButton", "Generate Multiple Choice Questions", onButtonPress)

 // function called when Generate MCQ button is pressed
async function onButtonPress() {
  try {
    // Get user input for question generation parameters
    const userInput = await getUserInput()
  
    if (!userInput) {
      codioIDE.coachBot.write("Question generation cancelled.")
      codioIDE.coachBot.showMenu()
      return
    }

    // Show thinking animation at the bottom
    codioIDE.coachBot.write("🔄 Generating question ideas from learning objectives...")
    codioIDE.coachBot.showThinkingAnimation()
  
    // Generate question ideas from learning objectives
    const questionIdeas = await generateQuestionIdeas(userInput.learning_objectives, userInput.number_of_questions)
    
    if (!questionIdeas) {
      codioIDE.coachBot.hideThinkingAnimation()
      codioIDE.coachBot.write("❌ Failed to generate question ideas. Please try again.")
      codioIDE.coachBot.showMenu()
      return
    }

    codioIDE.coachBot.hideThinkingAnimation()
    codioIDE.coachBot.write("✅ Question ideas generated! Now creating multiple choice assessments...")
    // Generate assessments using the question ideas
    await generateAssessments(questionIdeas, userInput.number_of_questions)
    
    // Hide thinking animation and show success message
    // codioIDE.coachBot.hideThinkingAnimation()
    codioIDE.coachBot.write(`✅ Successfully generated ${userInput.number_of_questions} multiple choice questions!`)
  
  } catch (error) {
    console.error("Error in MCQ generation:", error)
    codioIDE.coachBot.hideThinkingAnimation()
    codioIDE.coachBot.write("❌ An error occurred while generating questions. Please try again.")
  }
   codioIDE.coachBot.showMenu()
}

// Function to get user input
async function getUserInput() {
  try {
    const context = await codioIDE.coachBot.getContext()
    console.log("Context:", context)

    // Get learning objectives
    const learningObjectives = await codioIDE.coachBot.input("Please paste the relevant learning objectives:")
    if (!learningObjectives) return null

    // Get number of questions
    const numQuestions = await codioIDE.coachBot.input("How many questions would you like to generate")
    if (!numQuestions || isNaN(parseInt(numQuestions))) return null

    return {
      learning_objectives: learningObjectives.trim(),
      number_of_questions: parseInt(numQuestions)
    }
  } catch (error) {
    console.error("Error getting user input:", error)
    return null
  }
}

// Function to generate question ideas from learning objectives
async function generateQuestionIdeas(learningObjectives, numberOfQuestions) {
  try {
    console.log("Generating question ideas from learning objectives:", learningObjectives)
  
    // Replace placeholders in the prompt
    const prompt = ideaGenerationPrompt
      .replace(/{learning_objectives}/g, learningObjectives)
      .replace(/{number_of_questions}/g, numberOfQuestions)
  
    console.log("Sending idea generation prompt to LLM...")
  
    // Send the API request to the LLM
    const result = await codioIDE.coachBot.ask(
      {
        systemPrompt: ideaGenerationSystemPrompt,
        messages: [{
          "role": "user",
          "content": prompt,
        }]
      },
      { stream: false, preventMenu: true, modelSettings: {"maxTokens": 2000} }
    )
  
    console.log("LLM Response for ideas:", result.result)
    return result.result.trim()
  
  } catch (error) {
    console.error("Error generating question ideas:", error)
    return null
  }
}

// Function to generate assessments using assessment.generate()
async function generateAssessments(questionIdeas, numberOfQuestions) {
  try {
    console.log("Generating assessments using question ideas...")

    const ideasList = questionIdeas.match(/<idea id=\d+>.*?<\/idea>/gs);
    console.log(`List of question ideeas`, ideasList)

    // Create one assessment for each question
    for (let i = 0; i < numberOfQuestions; i++) {
      
      console.log(`Creating assessment ${i + 1} of ${numberOfQuestions}`)
      codioIDE.coachBot.write(`Creating assessment ${i + 1} of ${numberOfQuestions}`)
      codioIDE.coachBot.showThinkingAnimation()

      // Prepare the assessment data for Codio's assessment system
      const assessmentData = {
        assessmentType: 'multiple-choice',
        guidesContent: `Question ${i + 1}`, // Simple placeholder content
        filesList: [],
        userIntro: ideasList[i] // Generated ideas are placed here
      }
      
      try {
        // Generate the assessment using Codio's assessment API
        const result = await window.codioIDE.guides.assessments.generate(assessmentData)
        console.log('Assessment generated successfully:', result)
      
        // Save the assessment
        await window.codioIDE.guides.assessments.save(result.assessment, result.files)
        console.log('Assessment saved successfully')
      
        // Create a new page with the assessment
        const pageTitle = `Exercise ${i + 1} - MCQ`
        const pageContent = `{Check it! | assessment}(${result.assessment.taskId})
        
|||guidance
## Question Idea
${ideasList[i]}
|||

`
        await window.codioIDE.guides.structure.add({
          title: pageTitle,
          type: window.codioIDE.guides.structure.ITEM_TYPES.PAGE,
          content: pageContent,
          layout: window.codioIDE.guides.structure.LAYOUT.L_1_PANEL,
          closeAllTabs: false,
          showFileTree: false
        }, null) // -1 adds to the end
      
        console.log(`Page ${i + 1} created successfully: ${pageTitle}`)
        codioIDE.coachBot.hideThinkingAnimation()
        codioIDE.coachBot.write(`Page ${i + 1} with an MCQ created successfully: ${pageTitle}`)

      
      } catch (assessmentError) {
        console.error(`Error creating assessment ${i + 1}:`, assessmentError)
      
        // Fallback: create a simple page with the question ideas
        const fallbackContent = `## Exercise ${i + 1} - Multiple Choice Question

### Question Ideas:
${questionIdeas}

*Note: Assessment generation failed. Please try again or contact support.*`

        await window.codioIDE.guides.structure.add({
          title: `Exercise ${i + 1} - MCQ (Fallback)`,
          type: window.codioIDE.guides.structure.ITEM_TYPES.PAGE,
          content: fallbackContent,
          layout: window.codioIDE.guides.structure.LAYOUT.L_1_PANEL,
          closeAllTabs: false,
          showFileTree: false
        }, null, -1)
        codioIDE.coachBot.hideThinkingAnimation()

        console.log(`Fallback page ${i + 1} created successfully`)
      }
    }
  
  } catch (error) {
    console.error("Error generating assessments:", error)
    throw error
  }
}

// calling the function immediately by passing the required variables
})(window.codioIDE, window)
